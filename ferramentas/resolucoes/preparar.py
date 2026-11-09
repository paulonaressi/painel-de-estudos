# Prepara o material para escrever resoluções comentadas de um ano do ENEM extraído de PDF
# (data/enem/<ano>.json): uma imagem por questão, com o texto de apoio quando houver, e um
# manifesto por área com número, idioma, gabarito, caminho da imagem e texto extraído.
# Quem escreve as resoluções lê a imagem (a fonte de verdade) e segue ferramentas/resolucoes/instrucoes.md.
#
# Uso: python3 ferramentas/resolucoes/preparar.py 2024 [pasta de saída]
# Saída padrão: trabalho/resolucoes/enem-<ano>/
import json
import sys
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:  # versões antigas do PyMuPDF
    import fitz

RAIZ = Path(__file__).resolve().parent.parent.parent
DPI = 120  # texto de 9,5 pt fica com ~16 px: legível sem imagens enormes


def renderizar(doc, recortes, destino):
    partes = [doc[r[0] - 1].get_pixmap(dpi=DPI, clip=fitz.Rect(*r[1:])) for r in recortes]
    largura = max(p.width for p in partes)
    altura = sum(p.height for p in partes) + 8 * (len(partes) - 1)
    folha = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, largura, altura))
    folha.set_rect(folha.irect, (255, 255, 255))
    y = 0
    for p in partes:
        p.set_origin(0, y)
        folha.copy(p, fitz.IRect(p.irect) & fitz.IRect(folha.irect))
        y += p.height + 8
    folha.save(destino)


def main():
    if len(sys.argv) < 2:
        sys.exit('uso: python3 ferramentas/resolucoes/preparar.py <ano> [pasta de saída]')
    ano = int(sys.argv[1]) if sys.argv[1].isdigit() else sys.argv[1]  # ou "2024-reaplicacao", "2025-belem"
    destino = Path(sys.argv[2]) if len(sys.argv) > 2 else RAIZ / 'trabalho' / 'resolucoes' / f'enem-{ano}'
    destino.mkdir(parents=True, exist_ok=True)

    dados = json.loads((RAIZ / 'data' / 'enem' / f'{ano}.json').read_text(encoding='utf-8'))
    documentos = {}
    por_area = {}
    for q in dados['questoes']:
        doc = documentos.setdefault(q['pdf'], fitz.open(RAIZ / q['pdf']))
        nome = f"q{q['numero']:03d}{'-' + q['idioma'] if q['idioma'] else ''}.png"
        renderizar(doc, q.get('apoio', []) + q['recortes'], destino / nome)
        por_area.setdefault(q['area'], []).append({
            'numero': q['numero'],
            'idioma': q['idioma'],
            'gabarito': q['gabarito'],  # None = questão anulada
            'imagem': (destino / nome).resolve().as_posix(),
            'texto_extraido': q['texto'],
        })

    for area, itens in por_area.items():
        with open(destino / f'{area}.json', 'w', encoding='utf-8', newline='\n') as saida:  # write_text(newline=) só no 3.10+
            saida.write(json.dumps(itens, ensure_ascii=False, indent=1))
        anuladas = sum(1 for i in itens if not i['gabarito'])
        print(f'{area}: {len(itens)} questões ({anuladas} anuladas)')
    print(f'material em {destino}')


if __name__ == '__main__':
    main()
