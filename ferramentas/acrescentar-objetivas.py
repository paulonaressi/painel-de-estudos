# Acrescenta a data/vunesp-pesquisa.json os cadernos objetivos (e a edição Einstein 2027) que o
# levantamento de outubro/2026 não trazia: 1ª fase da Unesp, Conhecimentos Gerais da Famerp e da
# Santa Casa, Prova I do Einstein e Prova II da FMJ, de 2022 em diante.
#
# Cada caderno entra com duas fontes: o link oficial da Vunesp (documento.vunesp.com.br, conferido no
# navegador em 08/11/2026; o site recusa downloads automáticos desde então) e a cópia do Curso
# Objetivo, que é a baixada. Reexecutar não duplica nada.
#
# Uso: python3 ferramentas/acrescentar-objetivas.py && node ferramentas/baixar-cadernos.js --copias
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARQ = RAIZ / 'data' / 'vunesp-pesquisa.json'
OBJ = 'https://www.curso-objetivo.br/vestibular/resolucao-comentada'
VUN = 'https://documento.vunesp.com.br/documento/stream/'
TODAS = ['linguagens', 'humanas', 'natureza-matematica']

# (instituição, edição, rótulo, áreas, questões, stream oficial ou None, url da cópia do Objetivo)
CADERNOS = [
    # Famerp — 1º dia, Conhecimentos Gerais (80 objetivas)
    ('FAMERP', '2026', '1º dia — Prova de Conhecimentos Gerais (objetiva)', TODAS, '1-80', 'NzUyMjIyNQ%3d%3d', f'{OBJ}/famerp/2026/1dia/famerp2026_1dia_prova.pdf'),
    ('FAMERP', '2025', '1º dia — Prova de Conhecimentos Gerais (objetiva)', TODAS, '1-80', 'NjY1MTk1Nw%3d%3d', f'{OBJ}/famerp/2025/1dia/famerp2025_1dia_prova.pdf'),
    ('FAMERP', '2024', '1º dia — Prova de Conhecimentos Gerais (objetiva)', TODAS, '1-80', 'NTY0Mzg3MA%3d%3d', f'{OBJ}/famerp/2024/1dia/famerp2024_1dia_prova.pdf'),
    ('FAMERP', '2023', '1º dia — Prova de Conhecimentos Gerais (objetiva)', TODAS, '1-80', 'MzIxMTE5OA%3d%3d', f'{OBJ}/famerp/2023/1dia/famerp2023_1dia_prova.pdf'),
    ('FAMERP', '2022', '1º dia — Prova de Conhecimentos Gerais (objetiva)', TODAS, '1-80', None, f'{OBJ}/famerp/2022/1dia/famerp2022_1dia_prova.pdf'),
    # Santa Casa — Conhecimentos Gerais de Medicina
    ('FCMSCSP (Santa Casa de SP)', '2027', 'Prova de Conhecimentos Gerais (objetiva) — Medicina', TODAS, '1-80', 'Nzg4ODgxOQ%3d%3d', f'{OBJ}/santacasa/2027/1dia/santacasa2027_1dia_prova.pdf'),
    ('FCMSCSP (Santa Casa de SP)', '2026', 'Prova de Conhecimentos Gerais (objetiva) — Medicina', TODAS, '1-80', 'NzQ0MDYzNg%3d%3d', f'{OBJ}/santacasa/2026/1dia/santacasa2026_1dia_prova.pdf'),
    ('FCMSCSP (Santa Casa de SP)', '2025', 'Prova de Conhecimentos Gerais (objetiva) — Medicina', TODAS, '1-80', 'NjUzODYwOQ%3d%3d', f'{OBJ}/santacasa/2025/1dia/santacasa2025_1dia_prova.pdf'),
    ('FCMSCSP (Santa Casa de SP)', '2024', 'Prova de Conhecimentos Gerais (objetiva) — Medicina', TODAS, '1-80', 'NTIyMjUzNw%3d%3d', f'{OBJ}/santacasa/2024/1dia/santacasa2024_1dia_prova.pdf'),
    ('FCMSCSP (Santa Casa de SP)', '2023', 'Prova de Conhecimentos Gerais (objetiva) — Medicina', TODAS, '1-80', 'MzE1MTEwMA%3d%3d', f'{OBJ}/santacasa/2023/1dia/santacasa2023_1dia_prova.pdf'),
    ('FCMSCSP (Santa Casa de SP)', '2022', 'Prova de Conhecimentos Gerais (objetiva) — Medicina', TODAS, '1-80', None, f'{OBJ}/santacasa/2022/1dia/santacasa2022_1dia_prova.pdf'),
    # Einstein — Prova I (objetiva)
    ('FICSAE (Albert Einstein)', '2027', 'Prova I (objetiva)', TODAS, '1-50', 'NzkxNzM2Ng%3d%3d', f'{OBJ}/alberteinstein/2027/alberteinstein2027_prova_I.pdf'),
    ('FICSAE (Albert Einstein)', '2027', 'Prova II (discursiva) — caderno de questões e respostas', [], '1-5', 'NzkxNzM3MA%3d%3d', f'{OBJ}/alberteinstein/2027/alberteinstein2027_prova_II.pdf'),
    ('FICSAE (Albert Einstein)', '2026', 'Prova I (objetiva)', TODAS, '1-50', 'NzQxNzEyNA%3d%3d', f'{OBJ}/alberteinstein/2026/alberteinstein2026_prova_I.pdf'),
    ('FICSAE (Albert Einstein)', '2025', 'Prova I (objetiva)', TODAS, '1-50', 'NjU1NDk5Mg%3d%3d', f'{OBJ}/alberteinstein/2025/alberteinstein2025_prova_I.pdf'),
    ('FICSAE (Albert Einstein)', '2024', 'Prova I (objetiva)', TODAS, '1-50', 'NTI2MDA3Ng%3d%3d', f'{OBJ}/alberteinstein/2024/alberteinstein2024_prova_I.pdf'),
    ('FICSAE (Albert Einstein)', '2023', 'Prova I (objetiva)', TODAS, '1-50', 'MzE1ODc5Mg%3d%3d', f'{OBJ}/alberteinstein/2023/alberteinstein2023_prova_I.pdf'),
    ('FICSAE (Albert Einstein)', '2022', 'Prova I (objetiva)', TODAS, '1-50', None, f'{OBJ}/alberteinstein/2022/alberteinstein2022_prova_I.pdf'),
    # FMJ — Prova II (objetiva)
    ('FMJ', '2027', 'Prova II (objetiva)', TODAS, None, 'Nzg4Njc5Ng%3d%3d', f'{OBJ}/fmj/2027/fmj2027_prova_II.pdf'),
    ('FMJ', '2026', 'Prova II (objetiva)', TODAS, None, 'NzM5NjcxNQ%3d%3d', f'{OBJ}/fmj/2026/fmj2026_prova_II.pdf'),
    ('FMJ', '2025', 'Prova II (objetiva)', TODAS, None, 'NjUzMTU4Ng%3d%3d', f'{OBJ}/fmj/2025/fmj2025_prova_II.pdf'),
    ('FMJ', '2024', 'Prova II (objetiva)', TODAS, None, None, f'{OBJ}/fmj/2024/fmj2024_prova_II.pdf'),
]

# Unesp — 1ª fase (Conhecimentos Gerais, 90 objetivas): edição própria, ao lado da 2ª fase do mesmo ano.
UNESP_1FASE = [
    ('2026/2', 'NzY3MDg4Mw%3d%3d', f'{OBJ}/unesp/2026_2/1fase/UNESP2026_2_1fase_prova.pdf'),
    ('2026', 'NzQ2NDIyMA%3d%3d', f'{OBJ}/unesp/2026/1fase/UNESP2026_1fase_prova.pdf'),
    ('2025/2', 'Njg1NTY2MA%3d%3d', f'{OBJ}/unesp/2025_2/1fase/UNESP2025_2_1fase_prova.pdf'),
    ('2025', 'NjU5MzI0Mg%3d%3d', f'{OBJ}/unesp/2025/1fase/UNESP2025_1fase_prova.pdf'),
    ('2024/2', 'NTc4Mjg3NA%3d%3d', f'{OBJ}/unesp/2024_2/1fase/UNESP2024_2_1fase_prova.pdf'),
    ('2024', 'NTM0MTAyMA%3d%3d', f'{OBJ}/unesp/2024/1fase/UNESP2024_1fase_prova.pdf'),
    ('2023', 'MzE3NTk4Mg%3d%3d', f'{OBJ}/unesp/2023/1fase/UNESP2023_1fase_prova.pdf'),
]


def caderno(rotulo, areas, questoes, url, oficial):
    return {'rotulo': rotulo, 'areas': areas, 'questoes': questoes, 'url': url, 'host_oficial': oficial,
            'http_status': 200, 'content_type': 'application/pdf', 'x_frame_options': None, 'csp_frame_ancestors': None,
            'acrescentado': '2026-11-08'}


def main():
    pesquisa = json.loads(ARQ.read_text(encoding='utf-8'))
    edicoes = pesquisa['edicoes']
    acrescentados = 0

    def achar(inst, ed, fase=None):
        return next((e for e in edicoes if e['instituicao'] == inst and e['edicao'] == ed
                     and (fase is None or e.get('fase') == fase)), None)

    def por(ed, rotulo, areas, questoes, stream, copia):
        nonlocal acrescentados
        urls = {c['url'] for c in ed['cadernos']}
        if stream and VUN + stream not in urls:
            ed['cadernos'].append(caderno(rotulo, areas, questoes, VUN + stream, True))
            acrescentados += 1
        if copia not in urls:
            ed['cadernos'].append(caderno(f'{rotulo} (espelho Curso Objetivo)', areas, questoes, copia, False))
            acrescentados += 1

    for inst, ed_nome, rotulo, areas, questoes, stream, copia in CADERNOS:
        ed = achar(inst, ed_nome)
        if ed is None:  # Einstein 2027 ainda não existia no levantamento
            ed = {'instituicao': inst, 'edicao': ed_nome, 'ano': int(ed_nome[:4]), 'fase': 'Prova I (objetiva) + Prova II (discursiva e redação)',
                  'formato': 'mista', 'estrutura': 'Prova I: 50 questões objetivas; Prova II: 5 questões discursivas + redação',
                  'cadernos': [], 'resolucoes': [{'fonte': 'Curso Objetivo', 'url': f'{OBJ}/alberteinstein.aspx'}],
                  'respostas_esperadas': [], 'observacoes': 'Acrescentada em 08/11/2026 (código Vunesp FEAE2602).'}
            primeira = next(i for i, e in enumerate(edicoes) if e['instituicao'] == inst)
            edicoes.insert(primeira, ed)
        por(ed, rotulo, areas, questoes, stream, copia)
        # A fase não é renomeada: ela entra no id dos registros da aluna
        # (vunesp:<instituição>|<edição>|<fase>:…), que são sincronizados.

    for ed_nome, stream, copia in UNESP_1FASE:
        ed = achar('UNESP', ed_nome, '1ª fase')
        if ed is None:
            ed = {'instituicao': 'UNESP', 'edicao': ed_nome, 'ano': int(ed_nome[:4]), 'fase': '1ª fase', 'formato': 'objetiva',
                  'estrutura': '90 questões objetivas de Conhecimentos Gerais (Linguagens, Ciências Humanas, Ciências da Natureza e Matemática)',
                  'cadernos': [], 'resolucoes': [{'fonte': 'Curso Objetivo', 'url': f'{OBJ}/unesp.aspx'}],
                  'respostas_esperadas': [], 'observacoes': 'Acrescentada em 08/11/2026.'}
            segunda = next(i for i, e in enumerate(edicoes) if e['instituicao'] == 'UNESP' and e['edicao'] == ed_nome)
            edicoes.insert(segunda + 1, ed)
        por(ed, 'Prova de Conhecimentos Gerais (objetiva)', TODAS, '1-90', stream, copia)

    ARQ.write_text(json.dumps(pesquisa, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{acrescentados} cadernos acrescentados; {len(edicoes)} edições no levantamento')


if __name__ == '__main__':
    main()
