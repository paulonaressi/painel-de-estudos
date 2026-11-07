# Localiza cada questão dentro dos PDFs de prova e grava um índice por arquivo:
# em que página e em que retângulo está a questão (para a página recortá-la na tela)
# e o texto extraído (para classificar por disciplina e, no futuro, buscar).
#
# Uso: python ferramentas/extrair-questoes.py            cadernos da Vunesp + ENEM
#      python ferramentas/extrair-questoes.py vunesp     só os cadernos de provas/manifesto.json
#      python ferramentas/extrair-questoes.py enem       só os PDFs de provas/enem
#
# Saída: data/questoes/<instituição>/<arquivo>.json e data/enem/<ano>.json
import json
import re
import statistics
import sys
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:  # versões antigas do PyMuPDF
    import fitz

RAIZ = Path(__file__).resolve().parent.parent

RE_MARCA = re.compile(r'^[▪■•◆\s]*quest[ãa]o?\s*0*(\d{1,3})[\s▪■•◆]*$', re.I)
RE_MARCA_SEM_NUMERO = re.compile(r'^quest[ãa]o?$', re.I)
RE_NUMERO = re.compile(r'^0*(\d{1,3})$')
RE_SECAO = re.compile(r'^quest[õo]es\s+de\s+0*(\d{1,3})\s+a\s+0*(\d{1,3})(?:\s*\(op[çc][ãa]o\s*:?\s*(\w+)\))?\s*$', re.I)
RE_TITULO_AREA = re.compile(r'TECNOLOGIAS|^CI[ÊE]NCIAS|^MATEM[ÁA]TICA|^LINGUAGENS')
RE_APOIO = re.compile(r'quest[õo]es\s+(?:de\s+)?(?:n[úu]meros?\s+|n[ºo]s?\.?\s*)?0*(\d{1,3})(?:\s*,\s*0*\d{1,3})*\s*(?:a|e|até|ao)\s+0*(\d{1,3})', re.I)
# texto de apoio de uma questão só: "...para responder à questão 01" (Unesp 2019, questão 1)
RE_APOIO_UNICA = re.compile(r'para\s+responder\s+(?:à|a)\s+quest[ãa]o\s+(?:n[ºo]\.?\s*)?0*(\d{1,3})\b', re.I)
RE_APOIO_VERBO = re.compile(r'respond|leia|considere|examine|analise|observe|refere|texto|utilize|base|focaliz|instru[çc][ãa]o', re.I)
RE_REDACAO = re.compile(r'^(proposta de )?reda[çc][ãa]o$|^instru[çc][õo]es para a reda[çc][ãa]o', re.I)
RE_FIM = re.compile(r'^(classifica[çc][ãa]o peri[óo]dica|n[ãa]o assine esta folha|folha de rascunho|rascunho da reda[çc][ãa]o|transcreva a sua reda[çc][ãa]o|rascunho$)', re.I)
RE_CAIXA = re.compile(r'^resolu[çc][ãa]o( e resposta)?$', re.I)
RE_FAIXA_ENEM = re.compile(r'^(ENEM\d{4}){3,}')

MAX_SEGMENTOS = 8

# Cadernos antigos (Unesp 2005–2009) não têm a tarja "Questão N": a questão começa com o número em
# negrito seguido de ponto, sempre com dois dígitos ("01.", "10."). Esse marcador só vale no arquivo
# que não tem nenhuma tarja, para não confundir com itens numerados dentro dos enunciados; as
# instruções da capa ("3. Esta prova contém...") têm um dígito só. Definido por arquivo em preparar():
# 'ponto' ("01."), 'sozinho' (só o número na linha, em negrito: Famema 2022) ou False.
RE_NUMERO_PONTO = re.compile(r'^(\d{2})\.(?:\s|$)')
MARCA_POR_NUMERO = False
# Nesses cadernos o nome da disciplina separa as questões; sem tratá-lo, ele ficaria no fim do
# recorte da questão anterior.
RE_DISCIPLINA = re.compile(r'^(biologia|qu[íi]mica|f[íi]sica|matem[áa]tica|hist[óo]ria|geografia|filosofia|sociologia|'
                           r'literatura|l[íi]ngua portuguesa|l[íi]ngua inglesa|ingl[êe]s|franc[êe]s|espanhol)$', re.I)


def negrito(span):
    return 'bold' in span['font'].lower() or bool(span['flags'] & 16)


def linhas_da_pagina(pag):
    """Linhas de texto horizontais da página, com posição. Texto girado (marca-d'água) fica de fora."""
    linhas = []
    for bloco in pag.get_text('dict')['blocks']:
        for ln in bloco.get('lines', []):
            if abs(ln['dir'][1]) > 0.1:
                continue
            texto = re.sub(r'\s+', ' ', ''.join(s['text'] for s in ln['spans'])).strip()
            if not texto:
                continue
            x0, y0, x1, y1 = ln['bbox']
            linha = {'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'texto': texto}
            # "10." num pedaço em negrito só com o número (títulos como "2. Prova de..." não contam)
            primeiro = next((s for s in ln['spans'] if s['text'].strip()), None)
            m = RE_NUMERO_PONTO.match(texto)
            if m and primeiro and negrito(primeiro) and re.fullmatch(r'\d{2}\.?', primeiro['text'].strip()):
                linha['num_negrito'] = int(m.group(1))
            # número sozinho na linha, em negrito (Famema 2022, diagramação do Objetivo); longe do topo e
            # do rodapé, onde ficam os números de página
            elif (re.fullmatch(r'\d{1,2}', texto) and primeiro and negrito(primeiro)
                  and 0.04 * pag.rect.height < y0 < 0.93 * pag.rect.height):
                linha['num_sozinho'] = int(texto)
            linhas.append(linha)
    return linhas


def numero_da_marca(ln):
    """Número da questão que esta linha abre, ou None."""
    m = RE_MARCA.match(ln['texto'])
    if m:
        return int(m.group(1))
    if MARCA_POR_NUMERO == 'ponto' and 'num_negrito' in ln:
        return ln['num_negrito']
    if MARCA_POR_NUMERO == 'sozinho' and 'num_sozinho' in ln:
        return ln['num_sozinho']
    return None


def eh_marca(ln):
    return numero_da_marca(ln) is not None or bool(RE_MARCA_SEM_NUMERO.match(ln['texto']))


def caixas_graficas(pag):
    """Imagens e desenhos que contam como conteúdo (linhas finas e molduras de página não contam)."""
    area_pagina = pag.rect.width * pag.rect.height
    caixas = [fitz.Rect(i['bbox']) for i in pag.get_image_info()]
    for d in pag.get_drawings():
        r = d['rect']
        if min(r.width, r.height) < 1.5 or r.width * r.height > 0.6 * area_pagina:
            continue
        caixas.append(fitz.Rect(r))
    return caixas


class Pagina:
    def __init__(self, pag, numero):
        self.numero = numero
        self.largura = pag.rect.width
        self.altura = pag.rect.height
        self.linhas = linhas_da_pagina(pag)
        self.caixas = caixas_graficas(pag)
        self.imagens = len(pag.get_image_info())
        self.topo = 18.0
        self.base = self.altura - 38
        self.segs = []  # trechos da página na ordem de leitura: {'x0', 'x1', 'y0', 'y1'}
        self.caixa_resposta = False


def inicio_bruto(ln):
    """Linha que parece abrir uma questão, seção, texto de apoio ou a redação."""
    texto = ln['texto']
    return bool(eh_marca(ln) or RE_SECAO.match(texto) or RE_REDACAO.match(texto)
                or ('quest' in texto.lower() and RE_APOIO.search(texto) and RE_APOIO_VERBO.search(texto)))


def segmentos_em_colunas(p, esq, divisa, dir_):
    """Divide a página em faixas horizontais: de largura inteira ou em duas colunas.

    As provas misturam os dois formatos, às vezes na mesma página. A página é fatiada nos inícios
    que aparecem na coluna esquerda; a fatia é de largura inteira quando tem texto cruzando a divisa
    e nada que indique uma coluna direita (marcador de questão ou linhas alinhadas na margem dela).
    """
    # cabeçalho de seção na coluna esquerda com a coluna direita já começada ao lado (ENEM 2023, p. 20:
    # "Questões de 46 a 90" à esquerda e a tarja da 48 à direita) não fatia a página
    marcas_dir = [ln['y0'] for ln in p.corpo if ln['x0'] >= divisa - 5 and eh_marca(ln)]
    cortes = sorted({ln['y0'] - 6 for ln in p.corpo if ln['x0'] < divisa - 5 and inicio_bruto(ln)
                     and not (RE_SECAO.match(ln['texto']) and any(y <= ln['y0'] + 20 for y in marcas_dir))})
    limites = [p.topo] + [c for c in cortes if p.topo + 4 < c < p.base - 4] + [p.base]
    cruzam = [ln for ln in p.corpo if ln['x0'] < divisa - 25 and ln['x1'] > divisa + 25]
    graficos = [c for c in p.caixas if c.x0 < divisa - 40 and c.x1 > divisa + 40 and c.height >= 12]

    faixas = []
    for a, b in zip(limites, limites[1:]):
        dentro = lambda y0, y1: a <= (y0 + y1) / 2 < b
        textos = sum(1 for ln in cruzam if dentro(ln['y0'], ln['y1']))
        figuras = sum(1 for c in graficos if dentro(c.y0, c.y1))
        na_direita = [ln for ln in p.corpo if ln['x0'] >= divisa - 5 and dentro(ln['y0'], ln['y1'])]
        if any(inicio_bruto(ln) for ln in na_direita):
            inteira = False  # marcador de questão na metade direita só existe em duas colunas
        elif textos >= 2:
            inteira = True
        elif sum(1 for ln in na_direita if ln['x0'] <= divisa + 22) >= 2:
            inteira = False  # linhas alinhadas na margem da coluna direita
        else:
            inteira = bool(textos or figuras) or not na_direita
        if faixas and faixas[-1][2] == bool(inteira):
            faixas[-1] = (faixas[-1][0], b, bool(inteira))
        else:
            faixas.append((a, b, bool(inteira)))

    segs = []
    for a, b, inteira in faixas:
        if inteira:
            segs.append({'x0': esq, 'x1': dir_, 'y0': a, 'y1': b})
        else:
            # a coluna esquerda para um pouco antes da divisa, onde algumas provas têm um fio vertical
            segs.append({'x0': esq, 'x1': divisa - 3, 'y0': a, 'y1': b})
            segs.append({'x0': divisa + 1, 'x1': dir_, 'y0': a, 'y1': b})
    return segs


def preparar(doc):
    global MARCA_POR_NUMERO
    paginas = [Pagina(pag, i + 1) for i, pag in enumerate(doc)]

    # Sem nenhuma tarja "Questão N" no arquivo e com vários "NN." em negrito: caderno antigo.
    MARCA_POR_NUMERO = False
    tarjas_no_arquivo = any(RE_MARCA.match(ln['texto']) or RE_MARCA_SEM_NUMERO.match(ln['texto']) for p in paginas for ln in p.linhas)
    pontos = sum('num_negrito' in ln for p in paginas for ln in p.linhas)
    sozinhos = sum('num_sozinho' in ln for p in paginas for ln in p.linhas)
    MARCA_POR_NUMERO = False
    if not tarjas_no_arquivo and pontos >= 5:
        MARCA_POR_NUMERO = 'ponto'
    elif not tarjas_no_arquivo and sozinhos >= 5:
        MARCA_POR_NUMERO = 'sozinho'
        # folhas de resposta e de redação têm as linhas numeradas (1 a 15, 1 a 30): página com muitos
        # números soltos não é página de questões
        for p in paginas:
            if sum('num_sozinho' in ln for ln in p.linhas) > 8:
                for ln in p.linhas:
                    ln.pop('num_sozinho', None)

    # Duas colunas quando alguma página tem mais de um marcador de questão e um deles está na
    # metade direita. (Um marcador sozinho à direita é só a tarja da questão, que em alguns
    # cadernos de uma questão por página alterna de lado.)
    def tem_colunas(p):
        marcas = [ln for ln in p.linhas if eh_marca(ln)]
        return len(marcas) > 1 and any(ln['x0'] > 0.45 * p.largura for ln in marcas)
    em_colunas = any(tem_colunas(p) for p in paginas)

    # Nos cadernos de uma questão por página, o conteúdo começa na tarja "Questão N";
    # acima dela ficam os códigos de barras do caderno de respostas.
    tarjas = [ln['y0'] for p in paginas for ln in p.linhas if ln['y0'] < 120 and eh_marca(ln)]
    topo_pagina = min(tarjas) - 6.5 if tarjas else 46.0

    margens = {0: [], 1: []}
    marcas = {0: {'esq': [], 'dir': []}, 1: {'esq': [], 'dir': []}}
    for p in paginas:
        faixa = next((ln for ln in p.linhas if ln['y0'] < 0.2 * p.altura and RE_FAIXA_ENEM.match(ln['texto'])), None)
        caixa = next((ln for ln in p.linhas if RE_CAIXA.match(ln['texto'])), None)
        if faixa:
            p.topo = faixa['y1'] + 2
        elif not em_colunas:
            p.topo = topo_pagina
        if caixa:
            p.base = caixa['y0'] - 8
            p.caixa_resposta = True
        # tolerância no topo: títulos encostados na tarja do cabeçalho ainda são conteúdo
        p.corpo = [ln for ln in p.linhas if p.topo - 4 <= ln['y0'] <= p.base and not RE_FAIXA_ENEM.match(ln['texto'])]
        if caixa and p.corpo:
            # a última linha do enunciado pode encostar na caixa (Unesp 2020, questão 18): não cortá-la ao meio
            p.base = max(p.base, min(caixa['y0'] - 1, max(ln['y1'] for ln in p.corpo) + 1))
        if len(p.corpo) >= 12:
            xs0 = sorted(ln['x0'] for ln in p.corpo)
            xs1 = sorted(ln['x1'] for ln in p.corpo if ln['x1'] < p.largura - 5)
            # percentil na esquerda, para um caractere solto na margem não deslocar a coluna
            p.margens = (xs0[int(0.03 * len(xs0))], xs1[-1] if xs1 else p.largura - 30)
            margens[p.numero % 2].append(p.margens)
        else:
            p.margens = None
        for ln in p.corpo:
            if eh_marca(ln):
                marcas[p.numero % 2]['dir' if ln['x0'] > 0.45 * p.largura else 'esq'].append(ln['x0'])

    def mediana(valores, reserva):
        return statistics.median(valores) if valores else reserva

    for p in paginas:
        par = p.numero % 2
        vizinhas = margens[par] or margens[1 - par]
        esq_par = mediana([m[0] for m in vizinhas], 30.0)
        dir_par = mediana([m[1] for m in vizinhas], p.largura - 30.0)
        if not em_colunas:
            esq, dir_ = p.margens or (esq_par, dir_par)
            p.segs = [{'x0': max(esq - 8, 0), 'x1': min(dir_ + 8, p.largura), 'y0': p.topo, 'y1': p.base}]
        else:
            # A posição do marcador na coluna direita dá o início exato dela; o recuo do marcador
            # em relação ao texto (tarja "Questão") é o mesmo nas duas colunas.
            marca_esq = mediana(marcas[par]['esq'] or marcas[1 - par]['esq'], None)
            marca_dir = mediana(marcas[par]['dir'] or marcas[1 - par]['dir'], None)
            if MARCA_POR_NUMERO:
                # nos cadernos antigos a coluna direita muda alguns pontos de uma página para outra:
                # vale o marcador da própria página, quando ela tem
                proprias = [ln['x0'] for ln in p.corpo if eh_marca(ln) and ln['x0'] > 0.45 * p.largura]
                if proprias:
                    marca_dir = min(proprias)
            esq = esq_par - 8
            if marca_esq is None or marca_dir is None:
                divisa = (esq_par + dir_par) / 2
            else:
                divisa = marca_dir - max(0.0, marca_esq - esq_par) - 5
            p.segs = segmentos_em_colunas(p, max(esq, 0), divisa, min(p.largura, 2 * divisa - esq + 10))
        # 'col' é a posição do trecho na ordem de leitura da página
        for ln in p.corpo:
            meio = (ln['y0'] + ln['y1']) / 2
            candidatos = [i for i, sg in enumerate(p.segs) if sg['y0'] - 2 <= meio <= sg['y1'] + 2] or [0]
            ln['col'] = next((i for i in reversed(candidatos) if ln['x0'] >= p.segs[i]['x0'] - 2), candidatos[0])
        p.corpo.sort(key=lambda ln: (ln['col'], ln['y0'], ln['x0']))
    return paginas, em_colunas


def achar_inicios(paginas):
    """Pontos onde começa algo: questão, texto de apoio, cabeçalho de seção, redação ou fim da prova."""
    inicios = []
    ultimo_numero = 0
    parte = 0             # sobe quando a numeração recomeça dentro do arquivo (Prova I, Prova II...)
    vistos_na_parte = set()
    for p in paginas:
        tem_questao = any(eh_marca(ln) for ln in p.corpo)
        texto_pagina = ' '.join(ln['texto'] for ln in p.corpo)
        # página em branco ou de rascunho encerra o que vinha antes (uma questão de enunciado curto não é "vazia")
        vazia = not tem_questao and (len(texto_pagina) < 40 or (len(texto_pagina) < 130 and p.imagens == 0))
        if vazia or any(RE_FIM.match(ln['texto']) for ln in p.corpo):
            inicios.append({'tipo': 'fim', 'pag': p.numero, 'col': 0, 'y': p.topo, 'parte': parte})
            continue

        for i, ln in enumerate(p.corpo):
            texto = ln['texto']
            ini = None
            n = numero_da_marca(ln)
            if n is not None:
                # 6 pt acima da tarja, sem subir além do pé da linha de cima (ENEM 2023: a alternativa E da
                # 108 fica colada na tarja da 109 e era cortada ao meio)
                acima = [o['y1'] for o in p.corpo if o.get('col') == ln.get('col') and o['y0'] < ln['y0'] - 2
                         and o['y1'] <= ln['y0'] + 1 and o['x1'] > ln['x0'] and o['x0'] < ln['x1'] + 300]
                y = ln['y0'] - 6
                if acima and y < max(acima) + 0.5 < ln['y0']:
                    y = max(acima) + 0.5
                ini = {'tipo': 'questao', 'n': n, 'y': y}
            elif RE_MARCA_SEM_NUMERO.match(texto):
                # "questão" e o número vêm em pedaços separados na mesma linha
                par = next((o for o in p.corpo if o is not ln and abs(o['y0'] - ln['y0']) < 6
                            and abs(o['x0'] - ln['x0']) < 90 and RE_NUMERO.match(o['texto'])), None)
                if par:
                    ini = {'tipo': 'questao', 'n': int(RE_NUMERO.match(par['texto']).group(1)), 'y': min(ln['y0'], par['y0']) - 6}
            elif RE_SECAO.match(texto):
                m = RE_SECAO.match(texto)
                y = ln['y0']
                for acima in p.corpo:  # o título da área fica logo acima de "Questões de 01 a 45"
                    if acima['col'] == ln['col'] and 0 < ln['y0'] - acima['y0'] < 34 and RE_TITULO_AREA.search(acima['texto']):
                        y = min(y, acima['y0'])
                ini = {'tipo': 'secao', 'y': y - 3, 'idioma': (m.group(3) or '').lower().replace('ê', 'e') or None}
            elif RE_REDACAO.match(texto):
                ini = {'tipo': 'redacao', 'y': ln['y0'] - 6}
            elif MARCA_POR_NUMERO and RE_DISCIPLINA.match(texto):
                ini = {'tipo': 'secao', 'y': ln['y0'] - 3, 'idioma': None}
            elif 'quest' in texto.lower() or texto.endswith('-'):
                seguinte = p.corpo[i + 1]['texto'] if i + 1 < len(p.corpo) and p.corpo[i + 1]['col'] == ln['col'] else ''
                anterior = p.corpo[i - 1]['texto'] if i > 0 and p.corpo[i - 1]['col'] == ln['col'] else ''
                # a instrução pode quebrar de linha no meio ("...às ques-" / "tões de 22 a 25")
                junto = texto[:-1] + seguinte if texto.endswith('-') else texto + ' ' + seguinte
                m = RE_APOIO.search(junto)
                unica = None if m else RE_APOIO_UNICA.search(' '.join((anterior, junto)))
                if (m and RE_APOIO_VERBO.search(' '.join((anterior, junto)))) or unica:
                    de, ate = (int(m.group(1)), int(m.group(2))) if m else (int(unica.group(1)),) * 2
                    repetido = any(o['tipo'] == 'apoio' and (o['de'], o['ate'], o['parte']) == (de, ate, parte) for o in inicios)
                    recomeco = de == 1 and ultimo_numero >= 5  # texto de apoio que abre uma nova parte
                    if recomeco and ate <= de + 12:
                        parte, ultimo_numero, vistos_na_parte, repetido = parte + 1, 0, set(), False
                    if ultimo_numero < de and (de < ate <= de + 12 or unica) and not repetido:
                        y = ln['y0']
                        # a frase de instrução pode começar uma ou duas linhas antes
                        for volta in range(1, 4):
                            if i - volta < 0:
                                break
                            ant = p.corpo[i - volta]
                            if ant['col'] != ln['col'] or y - ant['y0'] > 16 or re.search(r'[.?!:)]$', ant['texto']) \
                                    or eh_marca(ant) or RE_NUMERO.match(ant['texto']):
                                break
                            y = ant['y0']
                        ini = {'tipo': 'apoio', 'de': de, 'ate': ate, 'y': y - 3}
            if ini and ini['tipo'] != 'questao' and p.numero <= 2 and not tem_questao \
                    and not (ini['tipo'] == 'apoio' and ini['de'] == ini['ate']):
                continue  # capa e instruções citam "questões de 01 a 05" sem ser texto de apoio
            if ini and ini['tipo'] == 'questao':
                if any(o['tipo'] == 'questao' and o['n'] == ini['n'] and o['pag'] == p.numero for o in inicios):
                    continue  # o mesmo marcador aparece duplicado em alguns arquivos
                if ini['n'] in vistos_na_parte:
                    parte, vistos_na_parte = parte + 1, set()
                vistos_na_parte.add(ini['n'])
                ultimo_numero = ini['n']
            if ini:
                ini.update({'pag': p.numero, 'col': ln['col'], 'parte': parte})
                inicios.append(ini)
    # Proposta de redação sem título em texto: página sem nenhum início, depois da última questão,
    # com os textos motivadores rotulados "Texto 1", "Texto 2"...
    com_inicio = {s['pag'] for s in inicios}
    ultima = max((s['pag'] for s in inicios if s['tipo'] == 'questao'), default=0)
    for p in paginas:
        if p.numero > ultima > 0 and p.numero not in com_inicio and any(re.match(r'^texto 1$', ln['texto'], re.I) for ln in p.corpo):
            inicios.append({'tipo': 'redacao', 'pag': p.numero, 'col': 0, 'y': p.topo, 'parte': parte})
            break
    inicios.sort(key=lambda s: (s['pag'], s['col'], s['y']))
    # Uma questão por página com o texto de apoio ACIMA da tarja (Einstein 2024, questão 5): se o
    # bloco anterior terminou na caixa de resposta de outra página, o topo desta página é da questão.
    for i, ini in enumerate(inicios):
        p = paginas[ini['pag'] - 1]
        anterior = inicios[i - 1] if i else None
        if (ini['tipo'] == 'questao' and len(p.segs) == 1 and ini['y'] - p.topo > 40 and anterior
                and anterior['pag'] < ini['pag'] and paginas[anterior['pag'] - 1].caixa_resposta
                and any(p.topo <= ln['y0'] < ini['y'] for ln in p.corpo)):
            ini['y'] = p.topo
    return inicios


def recortes_do_bloco(paginas, ini, fim):
    """Retângulos (um por trecho atravessado) do início deste bloco até o início do próximo."""
    recortes = []
    textos = []
    pag, col = ini['pag'], ini['col']
    for _ in range(MAX_SEGMENTOS):
        if pag > len(paginas):
            break
        p = paginas[pag - 1]
        primeiro = (pag, col) == (ini['pag'], ini['col'])
        ultimo = fim is not None and (pag, col) == (fim['pag'], fim['col'])
        if fim is not None and (pag, col) > (fim['pag'], fim['col']):
            break
        sg = p.segs[col]
        y0 = max(ini['y'], sg['y0']) if primeiro else sg['y0']
        y1 = min(fim['y'], sg['y1']) if ultimo else sg['y1']
        x0, x1 = sg['x0'], sg['x1']
        if y1 - y0 > 6:
            area = fitz.Rect(x0, y0, x1, y1)
            dentro = [ln for ln in p.corpo if ln['col'] == col and y0 - 1 <= (ln['y0'] + ln['y1']) / 2 <= y1 + 1]
            ys = [(ln['y0'], ln['y1']) for ln in dentro]
            for c in p.caixas:
                inter = c & area
                if not inter.is_empty and inter.height > 1 and inter.width > 1:
                    ys.append((inter.y0, inter.y1))
            if ys:
                topo = max(y0, min(a for a, _ in ys) - 4)
                base = min(y1, max(b for _, b in ys) + 5)
                recortes.append([pag, round(x0, 1), round(topo, 1), round(x1, 1), round(base, 1)])
                textos.extend(ln['texto'] for ln in sorted(dentro, key=lambda ln: (round(ln['y0'] / 3), ln['x0'])))
        if ultimo or p.caixa_resposta:
            break
        if col + 1 < len(p.segs):
            col += 1
        else:
            pag, col = pag + 1, 0
    texto = ' '.join(textos)
    texto = re.sub(r'^quest[ãa]o\s*\d+\s*', '', texto, flags=re.I)
    texto = re.sub(r'^\d+\s+quest[ãa]o\s*', '', texto, flags=re.I)
    return recortes, texto.strip()


def extrair(caminho):
    doc = fitz.open(caminho)
    paginas, em_colunas = preparar(doc)
    inicios = achar_inicios(paginas)

    questoes, apoios, redacao, avisos = [], [], None, []
    idioma = None
    vistos = set()
    for i, ini in enumerate(inicios):
        if ini['tipo'] == 'secao':
            idioma = ini['idioma']
        if ini['tipo'] in ('fim', 'secao'):
            continue
        fim = inicios[i + 1] if i + 1 < len(inicios) else None
        recortes, texto = recortes_do_bloco(paginas, ini, fim)
        if not recortes:
            avisos.append(f"{ini['tipo']} sem conteúdo na página {ini['pag']}")
            continue
        # 'parte' só entra no registro quando o arquivo tem mais de uma (numeração recomeçada)
        parte = {'parte': ini['parte']} if ini['parte'] else {}
        if ini['tipo'] == 'questao':
            chave = (ini['n'], idioma, ini['parte'])
            if chave in vistos:
                avisos.append(f"questão {ini['n']} repetida na página {ini['pag']}")
                continue
            vistos.add(chave)
            q = {'n': ini['n'], 'recortes': recortes, 'texto': texto, **parte}
            if idioma:
                q['idioma'] = idioma
            questoes.append(q)
        elif ini['tipo'] == 'apoio':
            apoios.append({'de': ini['de'], 'ate': ini['ate'], 'recortes': recortes, 'texto': texto, **parte})
        elif ini['tipo'] == 'redacao' and redacao is None:
            redacao = {'recortes': recortes, 'texto': texto, **parte}

    return {
        'paginas': len(paginas),
        'layout': 'colunas' if em_colunas else 'pagina',
        'questoes': questoes,
        'apoios': apoios,
        'redacao': redacao,
        'avisos': avisos,
    }


def faltantes(numeros, esperado):
    return [n for n in esperado if n not in numeros]


def gravar(destino, dados):
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dados, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def processar_vunesp():
    manifesto = json.loads((RAIZ / 'provas' / 'manifesto.json').read_text(encoding='utf-8'))
    pesquisa = json.loads((RAIZ / 'data' / 'vunesp-pesquisa.json').read_text(encoding='utf-8'))
    faixa_por_url = {c['url']: c.get('questoes') for ed in pesquisa['edicoes'] for c in ed['cadernos']}

    total = 0
    for url, item in manifesto.items():
        arquivo = item['arquivo']
        dados = extrair(RAIZ / arquivo)
        dados['arquivo'] = arquivo
        destino = RAIZ / 'data' / 'questoes' / Path(arquivo).relative_to('provas').with_suffix('.json')
        gravar(destino, dados)
        item['indice'] = destino.relative_to(RAIZ).as_posix()
        item['questoes'] = len(dados['questoes'])

        numeros = {q['n'] for q in dados['questoes']}
        partes = len({q.get('parte', 0) for q in dados['questoes']})
        m = re.match(r'(\d+)\D+(\d+)', faixa_por_url.get(url) or '')
        falta = faltantes(numeros, range(int(m.group(1)), int(m.group(2)) + 1)) if m and partes == 1 else []
        total += len(dados['questoes'])
        nota = f" FALTAM {falta}" if falta else ''
        nota += f" | {partes} partes" if partes > 1 else ''
        nota += f" | {'; '.join(dados['avisos'])}" if dados['avisos'] else ''
        print(f"{len(dados['questoes']):3d} questões, {len(dados['apoios'])} apoios, redação {'sim' if dados['redacao'] else 'não'}  "
              f"[{dados['layout']}] {arquivo[7:]}{nota}")
    (RAIZ / 'provas' / 'manifesto.json').write_text(json.dumps(manifesto, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f"Vunesp: {total} questões em {len(manifesto)} cadernos")


def ler_gabarito(caminho):
    """{numero: letra | [inglês, espanhol] | None (anulada)} a partir do PDF de gabarito do INEP."""
    tokens = [t.strip() for pag in fitz.open(caminho) for t in pag.get_text().split('\n') if t.strip()]
    gabarito = {}
    i = 0
    while i < len(tokens):
        if re.fullmatch(r'\d{1,3}', tokens[i]) and 1 <= int(tokens[i]) <= 180:
            n = int(tokens[i])
            respostas = []
            while i + 1 < len(tokens) and re.fullmatch(r'[A-E]|Anulad[oa]', tokens[i + 1], re.I) and len(respostas) < 2:
                i += 1
                respostas.append(tokens[i].upper() if len(tokens[i]) == 1 else None)
            if respostas:
                gabarito[n] = respostas if len(respostas) == 2 else respostas[0]
        i += 1
    return gabarito


def area_enem(numero):
    return ['linguagens', 'humanas', 'natureza', 'matematica'][(numero - 1) // 45]


def processar_enem():
    pasta = RAIZ / 'provas' / 'enem'
    anos = sorted({int(p.name[:4]) for p in pasta.glob('*_PV_impresso_*.pdf')})
    for ano in anos:
        questoes = []
        for prova in sorted(pasta.glob(f'{ano}_PV_impresso_*.pdf')):
            gabarito = ler_gabarito(prova.with_name(prova.name.replace('_PV_', '_GB_')))
            dados = extrair(prova)
            arquivo = prova.relative_to(RAIZ).as_posix()
            for q in dados['questoes']:  # (no ENEM a repetição de 1 a 5 é a versão por idioma, não outra parte)
                n = q['n']
                # só as cinco primeiras questões têm versão por idioma
                idioma = {'inglês': 'ingles', 'ingles': 'ingles', 'espanhol': 'espanhol'}.get(q.get('idioma') or '') if n <= 5 else None
                resposta = gabarito.get(n)
                if isinstance(resposta, list):
                    resposta = resposta[0 if idioma != 'espanhol' else 1]
                apoios = [a for a in dados['apoios'] if a['de'] <= n <= a['ate'] and a.get('parte', 0) == q.get('parte', 0)]
                questoes.append({'numero': n, 'idioma': idioma, 'area': area_enem(n), 'gabarito': resposta, 'pdf': arquivo,
                                 'apoio': [r for a in apoios for r in a['recortes']], 'recortes': q['recortes'],
                                 'texto': ' '.join([a['texto'] for a in apoios] + [q['texto']])})
            if dados['avisos']:
                print(f"  avisos em {prova.name}: {'; '.join(dados['avisos'])}")
        questoes.sort(key=lambda q: (q['numero'], q['idioma'] or ''))
        gravar(RAIZ / 'data' / 'enem' / f'{ano}.json', {'ano': ano, 'fonte': 'INEP — cadernos azuis', 'questoes': questoes})

        numeros = {q['numero'] for q in questoes}
        sem = [q['numero'] for q in questoes if not q['gabarito']]
        idiomas = sorted({q['idioma'] for q in questoes if q['idioma']})
        print(f"ENEM {ano}: {len(questoes)} questões, faltam {faltantes(numeros, range(1, 181))}, "
              f"sem gabarito (anuladas) {sem}, idiomas {idiomas}")


if __name__ == '__main__':
    alvo = sys.argv[1] if len(sys.argv) > 1 else 'tudo'
    if alvo in ('tudo', 'vunesp'):
        processar_vunesp()
    if alvo in ('tudo', 'enem'):
        processar_enem()
