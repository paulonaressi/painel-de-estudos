# Gabarito das questões objetivas da Vunesp a partir das resoluções comentadas do Curso Objetivo
# (PDFs com "Resposta: X" depois de cada questão). Não há base aberta de gabaritos da Vunesp, e as
# listas oficiais respondem 403 a programas.
#
# Cada questão objetiva recortada (data/questoes/**, 4+ alternativas no texto) é casada com o bloco
# da resolução que tem mais palavras em comum com ela — o número não é usado, porque a resolução
# às vezes numera diferente (partes, idiomas). Só entra o casamento claro.
#
# Uso: python3 ferramentas/gabaritos-vunesp.py [INST ...]     (padrão: todas)
# Saída: data/gabaritos/<mesmo caminho do índice>.json e data/gabaritos/indice.json
# Os PDFs baixados ficam em trabalho/gabaritos/ (fora do site).
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


def main():
    filtro = [a.upper() for a in sys.argv[1:]]
    pesquisa = json.loads((RAIZ / 'data' / 'vunesp-pesquisa.json').read_text(encoding='utf-8'))['edicoes']
    destino = RAIZ / 'data' / 'gabaritos'
    indice_geral, total, sem = set(), 0, 0
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
        por_indice = {}
        for rel, q in questoes:
            alvo = palavras(q['texto'])
            notas = sorted(((len(alvo & b) / max(1, len(alvo)), letra, url) for b, letra, url in todos), reverse=True)
            # casamento claro: boa parte das palavras da questão no bloco, e bem à frente do segundo colocado
            if notas and notas[0][0] >= 0.5 and (len(notas) == 1 or notas[0][0] - notas[1][0] >= 0.15):
                por_indice.setdefault(rel, {})[f"{q.get('parte', 0)}:{q['n']}"] = notas[0][1]
                total += 1
            else:
                sem += 1
        for rel, gab in por_indice.items():
            arquivo = destino / Path(rel).relative_to('data/questoes')
            atual = json.loads(arquivo.read_text(encoding='utf-8'))['questoes'] if arquivo.exists() else {}
            atual.update(gab)
            arquivo.parent.mkdir(parents=True, exist_ok=True)
            with open(arquivo, 'w', encoding='utf-8', newline='\n') as f:
                f.write(json.dumps({'indice': rel, 'origem': 'Curso Objetivo — resolução comentada (gabarito não oficial)',
                                    'questoes': dict(sorted(atual.items(), key=lambda kv: [int(x) for x in kv[0].split(':')]))},
                                   ensure_ascii=False, indent=1))
            indice_geral.add(rel)
        print(f"{ed['instituicao'].split()[0]} {ed['edicao']}: {sum(len(g) for g in por_indice.values())}/{len(questoes)} objetivas com gabarito")
    arquivo_indice = destino / 'indice.json'
    lista = set(json.loads(arquivo_indice.read_text(encoding='utf-8'))) if arquivo_indice.exists() else set()
    with open(arquivo_indice, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(sorted(lista | indice_geral), ensure_ascii=False, indent=1))
    print(f'{total} com gabarito, {sem} sem casamento claro')


if __name__ == '__main__':
    main()
