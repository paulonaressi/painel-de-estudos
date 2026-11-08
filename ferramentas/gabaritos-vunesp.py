# Gabarito das questões objetivas da Vunesp, de duas origens (a oficial prevalece):
#
# 1. Oficial: o arquivo de gabarito da própria Vunesp (com o código do concurso), em
#    provas/gabaritos-vunesp/<nome>.pdf, ligado ao caderno por LIGACOES. É a versão do dia da prova
#    (antes dos recursos), baixada do espelho do Curso Objetivo porque o site da Vunesp recusa
#    programas. Questão anulada vai para "anuladas".
# 2. Curso Objetivo: as resoluções comentadas (PDFs com "Resposta: X" depois de cada questão). Cada
#    questão objetiva recortada (data/questoes/**, 4+ alternativas no texto) é casada com o bloco da
#    resolução que tem mais palavras em comum com ela — o número não é usado, porque a resolução às
#    vezes numera diferente (partes, idiomas). Só entra o casamento claro. Os PDFs ficam em
#    trabalho/gabaritos/ (fora do site).
#
# Uso: python3 ferramentas/gabaritos-vunesp.py [INST ...]       (as duas origens; padrão: todas)
#      python3 ferramentas/gabaritos-vunesp.py --oficiais       (só os oficiais, sem baixar nada)
# Saída: data/gabaritos/<mesmo caminho do índice>.json e data/gabaritos/indice.json:
#   {"indice": …, "origem": …, "questoes": {"parte:n": "A"}, "oficial": ["parte:n", …], "anuladas": [...]}
#   "oficial" lista as chaves que vêm do gabarito da Vunesp; as demais vêm do Curso Objetivo.
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:
    import fitz

RAIZ = Path(__file__).resolve().parent.parent
CACHE = RAIZ / 'trabalho' / 'gabaritos'
BASE = 'https://www.curso-objetivo.br/vestibular/resolucao-comentada'
# Gabaritos oficiais: arquivo em provas/gabaritos-vunesp/ -> caderno local (como está em provas/manifesto.json)
LIGACOES = {
    **{f'unesp-{e}-1fase': f'provas/unesp/{e}_prova-de-conhecimentos-gerais-objetiva-espelho-curso-objetiv.pdf'
       for e in ['2023', '2024', '2024-2', '2025', '2025-2', '2026', '2026-2']},
    **{f'famerp-{a}-1dia': f'provas/famerp/{a}_1-dia-prova-de-conhecimentos-gerais-objetiva-espelho-curso-o.pdf'
       for a in range(2022, 2027)},
    **{f'santacasa-{a}-1dia': f'provas/fcmscsp/{a}_prova-de-conhecimentos-gerais-objetiva-medicina-espelho-curs.pdf'
       for a in range(2022, 2028)},
    **{f'einstein-{a}-prova-i': f'provas/ficsae/{a}_prova-i-objetiva-espelho-curso-objetivo.pdf'
       for a in range(2022, 2028)},
    **{f'fmj-{a}-prova-ii': f'provas/fmj/{a}_prova-ii-objetiva-espelho-curso-objetivo.pdf' for a in range(2024, 2028)},
    **{f'famema-{a}-prova-ii': f'provas/famema/{a}_prova-ii-objetiva-com-gabarito-oficial-redacao-segundo-o-ind.pdf'
       for a in (2025, 2026)},
    # arquivo único com Prova I, Prova I repetida e Prova II: o gabarito é só da parte 2 (Prova II)
    'famema-2024-prova': 'provas/famema/2024_prova-espelho-curso-objetivo.pdf#2',
    'unesp-2022-2fase': 'provas/unesp/2022_prova-de-conhecimentos-especificos-versao-1-para-divulgacao-.pdf',
    'unesp-2023-2fase': 'provas/unesp/2023_prova-de-conhecimentos-especificos-versao-1-para-divulgacao-.pdf',
    # 2018, 2019 e 2021: o rótulo do caderno não diz "objetiva", mas o 1º dia é objetivo (gabaritos UFSP1701,
    # UFSP1801 e UFSP2001, versão 1, baixados do Curso Objetivo em 08/11/2026)
    **{f'unifesp-{a}-1dia': f'provas/unifesp/{a}_1-dia-lingua-portuguesa-lingua-inglesa-e-redacao-espelho-cur.pdf'
       for a in (2018, 2019, 2021)},
    'unifesp-2022-1dia': 'provas/unifesp/2022_1-dia-lingua-portuguesa-lingua-inglesa-e-redacao-espelho-cur.pdf',
    'unifesp-2023-1dia': 'provas/unifesp/2023_1-dia-lingua-portuguesa-e-lingua-inglesa-objetiva-e-redacao.pdf',
    'unifesp-2024-1dia': 'provas/unifesp/2024_1-dia-lingua-portuguesa-e-lingua-inglesa-objetiva-e-redacao.pdf',
    'unifesp-2025-1dia': 'provas/unifesp/2025_1-dia-lingua-portuguesa-e-lingua-inglesa-objetiva-e-redacao.pdf',
    'unifesp-2026-1dia': 'provas/unifesp/2026_1-dia-lingua-portuguesa-e-lingua-inglesa-objetiva-e-redacao.pdf',
}

PASTA = RAIZ / 'provas' / 'gabaritos-vunesp'
# "12 - C", "12 - ANULADA", "12 - *" (só a "Versão 1", a de divulgação, que é a do caderno publicado)
ITEM = re.compile(r'(?m)^\s*(\d{1,3})\s*-\s*([A-E]|ANULAD[AO]|\*)\s*$', re.I)
ORIGEM_OBJETIVO = 'Curso Objetivo — resolução comentada (gabarito não oficial)'
ORIGEM_OFICIAL = 'Vunesp — gabarito oficial (versão do dia da prova, antes dos recursos)'
RE_RESPOSTA = re.compile(r'^resposta\s*:?\s*([A-E])\b', re.I)


def palavras(texto):
    t = unicodedata.normalize('NFKD', texto or '').lower()
    t = ''.join(c for c in t if not unicodedata.combining(c))
    return set(re.findall(r'[a-z]{5,}', t))


def objetiva(texto):
    return len(set(re.findall(r'\(([A-E])\)', texto))) >= 4


def ler_catalogo():
    bruto = (RAIZ / 'data' / 'vunesp-catalogo.js').read_text(encoding='utf-8')
    return json.loads(bruto[bruto.index('{'):bruto.rstrip().rindex('}') + 1])['edicoes']


def urls_da_edicao(ed, pesquisa):
    """PDFs de resolução do Objetivo: os do levantamento e, se não houver, os do padrão de endereço."""
    inst = ed['instituicao'].split()[0].lower()
    achados = []
    for e in pesquisa:
        if e.get('instituicao', '').split()[0].lower() == inst and str(e.get('edicao')) == str(ed['edicao']):
            achados += [r['url'] for r in e.get('resolucoes', []) if r['url'].lower().endswith('.pdf')
                        and 'curso-objetivo' in r['url'] and '_prova' not in r['url']]
    if not achados and inst in ('unifesp', 'famema'):
        ano = str(ed['edicao']).replace('/', '-')
        # o nome muda de ano para ano: unifesp2012_1dia.pdf, unifesp2011_1dia_resolucao.pdf, UNIFESP_2003_1dia.pdf
        achados = [f'{BASE}/{inst}/{ano}/{d}dia/{nome}' for d in (1, 2, 3)
                   for nome in (f'{inst}{ano}_{d}dia.pdf', f'{inst}{ano}_{d}dia_resolucao.pdf', f'{inst.upper()}_{ano}_{d}dia.pdf')]
    return achados


def baixar(url):
    destino = CACHE / url.split('/resolucao-comentada/')[-1]
    if not destino.exists():
        destino.parent.mkdir(parents=True, exist_ok=True)
        r = subprocess.run(['curl', '-fsSL', '--max-time', '120', '-A', 'Mozilla/5.0', '-o', str(destino), url])
        if r.returncode != 0 or not destino.exists() or destino.read_bytes()[:5] != b'%PDF-':
            if destino.exists():
                destino.unlink()
            return None
    return destino


def blocos(pdf):
    """[(palavras do bloco, letra)]. Dois formatos do Objetivo: "Resposta: X" depois da questão (2015+)
    ou, nos antigos, a letra sozinha na linha logo abaixo do número, antes do enunciado ("3" / "B")."""
    linhas = [l.strip() for pag in fitz.open(pdf) for l in pag.get_text().split('\n')]
    saida, atual = [], []
    for linha in linhas:
        m = RE_RESPOSTA.match(linha)
        if m:
            saida.append((palavras(' '.join(atual)), m.group(1).upper()))
            atual = []
        else:
            atual.append(linha)
    if len(saida) >= 5:
        return saida
    saida, atual, letra = [], [], None
    for i, linha in enumerate(linhas):
        cabeca = re.fullmatch(r'\d{1,3}', linha) and i + 1 < len(linhas) and re.fullmatch(r'[A-E]', linhas[i + 1])
        if cabeca:
            if letra:
                saida.append((palavras(' '.join(atual)), letra))
            letra, atual = linhas[i + 1], []
        elif letra and not re.fullmatch(r'[A-E]', linha):
            atual.append(linha)
    if letra:
        saida.append((palavras(' '.join(atual)), letra))
    if len(saida) >= 5:
        return saida
    # 2003–2005: só a letra minúscula numa linha, antes do enunciado, sem o número ("d" / "A leitura…")
    saida, atual, letra = [], [], None
    for linha in linhas:
        if re.fullmatch(r'[a-e]', linha):
            if letra:
                saida.append((palavras(' '.join(atual)), letra))
            letra, atual = linha.upper(), []
        elif letra:
            atual.append(linha)
    if letra:
        saida.append((palavras(' '.join(atual)), letra))
    return saida


def ler_oficial(caminho):
    """{"12": "C" ou None (anulada)} da primeira versão listada no arquivo da Vunesp."""
    texto = '\n'.join(p.get_text() for p in fitz.open(caminho))
    versoes = re.split(r'(?i)vers[ãa]o\s+\d', texto)
    corpo = versoes[1] if len(versoes) > 1 else texto
    gabarito = {}
    for n, letra in ITEM.findall(corpo):
        gabarito.setdefault(n, letra.upper() if len(letra) == 1 and letra != '*' else None)
    return gabarito


def ordenar(chaves):
    return sorted(chaves, key=lambda k: [int(x) for x in k.split(':')])


class Gabaritos:
    """Os arquivos de data/gabaritos/, lidos uma vez e regravados no fim."""

    def __init__(self):
        self.pasta = RAIZ / 'data' / 'gabaritos'
        self.dados = {}

    def de(self, rel):
        if rel not in self.dados:
            arquivo = self.pasta / Path(rel).relative_to('data/questoes')
            d = json.loads(arquivo.read_text(encoding='utf-8')) if arquivo.exists() else {}
            self.dados[rel] = {'questoes': d.get('questoes', {}), 'oficial': set(d.get('oficial', [])),
                               'anuladas': set(d.get('anuladas', []))}
        return self.dados[rel]

    def objetivo(self, rel, chave, letra):
        g = self.de(rel)
        if chave in g['oficial']:  # o oficial prevalece
            return
        g['questoes'][chave] = letra

    def oficial(self, rel, chave, letra):
        g = self.de(rel)
        g['oficial'].add(chave)
        if letra is None:
            g['questoes'].pop(chave, None)
            g['anuladas'].add(chave)
        else:
            g['questoes'][chave] = letra
            g['anuladas'].discard(chave)

    def gravar(self):
        for rel, g in self.dados.items():
            if not g['questoes'] and not g['anuladas']:
                continue
            arquivo = self.pasta / Path(rel).relative_to('data/questoes')
            arquivo.parent.mkdir(parents=True, exist_ok=True)
            todas = set(g['questoes']) | g['anuladas']
            so_oficial = todas <= g['oficial']
            saida = {'indice': rel,
                     'origem': ORIGEM_OFICIAL if so_oficial else (
                         f'{ORIGEM_OFICIAL}; as demais: {ORIGEM_OBJETIVO}' if g['oficial'] else ORIGEM_OBJETIVO),
                     'questoes': {k: g['questoes'][k] for k in ordenar(g['questoes'])}}
            if g['oficial']:
                saida['oficial'] = ordenar(g['oficial'])
            if g['anuladas']:
                saida['anuladas'] = ordenar(g['anuladas'])
            with open(arquivo, 'w', encoding='utf-8', newline='\n') as f:
                f.write(json.dumps(saida, ensure_ascii=False, indent=1))
        arquivo_indice = self.pasta / 'indice.json'
        lista = set(json.loads(arquivo_indice.read_text(encoding='utf-8'))) if arquivo_indice.exists() else set()
        lista |= {rel for rel, g in self.dados.items() if g['questoes'] or g['anuladas']}
        with open(arquivo_indice, 'w', encoding='utf-8', newline='\n') as f:
            f.write(json.dumps(sorted(lista), ensure_ascii=False, indent=1))


def do_objetivo(gab, filtro):
    pesquisa = json.loads((RAIZ / 'data' / 'vunesp-pesquisa.json').read_text(encoding='utf-8'))['edicoes']
    total, sem = 0, 0
    for ed in ler_catalogo():
        if filtro and not any(ed['instituicao'].upper().startswith(f) for f in filtro):
            continue
        questoes = []
        for cad in ed['cadernos']:
            loc = cad.get('local')
            if not loc:
                continue
            idx = json.loads((RAIZ / loc['indice']).read_text(encoding='utf-8'))
            for q in idx['questoes']:
                if q.get('parte', 0) == loc['parte'] and q['n'] in loc['numeros'] and objetiva(q['texto']):
                    questoes.append((loc['indice'], q))
        if not questoes:
            continue
        todos = []
        for url in urls_da_edicao(ed, pesquisa):
            pdf = baixar(url)
            if pdf:
                todos += [(b, letra, url) for b, letra in blocos(pdf)]
        achadas = 0
        for rel, q in questoes:
            alvo = palavras(q['texto'])
            notas = sorted(((len(alvo & b) / max(1, len(alvo)), letra, url) for b, letra, url in todos), reverse=True)
            # casamento claro: boa parte das palavras da questão no bloco, e bem à frente do segundo colocado
            if notas and notas[0][0] >= 0.5 and (len(notas) == 1 or notas[0][0] - notas[1][0] >= 0.15):
                gab.objetivo(rel, f"{q.get('parte', 0)}:{q['n']}", notas[0][1])
                total += 1
                achadas += 1
            else:
                sem += 1
        print(f"{ed['instituicao'].split()[0]} {ed['edicao']}: {achadas}/{len(questoes)} objetivas com gabarito do Objetivo")
    print(f'Curso Objetivo: {total} com gabarito, {sem} sem casamento claro')


def dos_oficiais(gab, filtro):
    manifesto = json.loads((RAIZ / 'provas' / 'manifesto.json').read_text(encoding='utf-8'))
    indice_do_arquivo = {v['arquivo']: v.get('indice') for v in manifesto.values()}
    total, diferentes = 0, []
    for nome, caderno in sorted(LIGACOES.items()):
        if filtro and not any(nome.upper().startswith(f) for f in filtro):
            continue
        pdf = PASTA / f'{nome}.pdf'
        arquivo, _, parte = caderno.partition('#')
        rel = indice_do_arquivo.get(arquivo)
        if not pdf.exists() or not rel:
            print(f'{nome}: {"falta o gabarito" if not pdf.exists() else "caderno sem índice"}')
            continue
        numeros = {q['n'] for q in json.loads((RAIZ / rel).read_text(encoding='utf-8'))['questoes']
                   if q.get('parte', 0) == int(parte or 0)}
        g = ler_oficial(pdf)
        antes = dict(gab.de(rel)['questoes'])
        for n, letra in g.items():
            chave = f'{int(parte or 0)}:{int(n)}'
            if antes.get(chave) and letra and antes[chave] != letra and chave not in gab.de(rel)['oficial']:
                diferentes.append(f'{nome} {chave}: Objetivo {antes[chave]}, oficial {letra}')
            gab.oficial(rel, chave, letra)
            total += 1
        anuladas = sorted(int(n) for n, v in g.items() if v is None)
        fora = sorted(int(n) for n in g if int(n) not in numeros)
        print(f'{nome}: {len(g)} questões{f", anuladas {anuladas}" if anuladas else ""}'
              f'{f", sem recorte {fora}" if fora else ""}')
    print(f'Oficiais: {total} questões')
    for d in diferentes:
        print('  DIFERE', d)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    filtro = [a.upper() for a in args]
    gab = Gabaritos()
    if '--oficiais' not in sys.argv:
        do_objetivo(gab, filtro)
    dos_oficiais(gab, filtro)  # por último: o oficial prevalece sobre o Objetivo
    gab.gravar()


if __name__ == '__main__':
    main()
