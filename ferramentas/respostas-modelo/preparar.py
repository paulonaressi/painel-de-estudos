# Prepara o material para escrever respostas-modelo das questões discursivas da Vunesp: uma imagem por
# questão (com o texto de apoio, quando há) e manifestos em lotes, para um agente por lote seguir
# ferramentas/respostas-modelo/instrucoes.md. Só entram cadernos com as questões já recortadas
# (data/vunesp-catalogo.js, campo "local"); questões objetivas e a redação ficam de fora.
#
# Uso: python3 ferramentas/respostas-modelo/preparar.py UNESP:2024-2026 FAMERP,FAMEMA:2024-2027 [--lote 45] [--pasta nome]
#      --objetivas: em vez das discursivas, as objetivas que têm gabarito em data/gabaritos/ (campo
#      "gabarito" no lote; o roteiro é ferramentas/respostas-modelo/instrucoes-objetivas.md)
#      (instituição pelo começo do nome no catálogo; anos pelo campo "ano" da edição)
# Saída: trabalho/respostas-modelo/<pasta, padrão a data>/lote-NN.json e as imagens
import json
import re
import sys
from datetime import date
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:  # versões antigas do PyMuPDF
    import fitz

RAIZ = Path(__file__).resolve().parent.parent.parent
DPI = 120


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


def objetiva(texto):
    """Questão de múltipla escolha: traz pelo menos quatro alternativas (A) a (E)."""
    return len(set(re.findall(r'\(([A-E])\)', texto))) >= 4


def ler_catalogo():
    bruto = (RAIZ / 'data' / 'vunesp-catalogo.js').read_text(encoding='utf-8')
    return json.loads(bruto[bruto.index('{'):bruto.rstrip().rindex('}') + 1])['edicoes']


def filtros(args):
    saida = []
    for arg in args:
        insts, anos = arg.split(':')
        ini, fim = (int(a) for a in anos.split('-'))
        saida.append(([i.strip().upper() for i in insts.split(',')], ini, fim))
    return saida


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    tamanho = int(sys.argv[sys.argv.index('--lote') + 1]) if '--lote' in sys.argv else 45
    if '--lote' in sys.argv:
        args.remove(str(tamanho))
    pasta = sys.argv[sys.argv.index('--pasta') + 1] if '--pasta' in sys.argv else date.today().isoformat()
    if '--pasta' in sys.argv:
        args.remove(pasta)
    so_objetivas = '--objetivas' in sys.argv
    if not args:
        sys.exit('uso: python3 ferramentas/respostas-modelo/preparar.py INST[,INST]:ANO-ANO ... [--lote 45]')
    regras = filtros(args)
    destino = RAIZ / 'trabalho' / 'respostas-modelo' / pasta
    (destino / 'imagens').mkdir(parents=True, exist_ok=True)

    itens, documentos, ignoradas = [], {}, 0
    for ed in ler_catalogo():
        if not any(any(ed['instituicao'].upper().startswith(i) for i in insts) and ini <= ed['ano'] <= fim
                   for insts, ini, fim in regras):
            continue
        if ed.get('formato') == 'objetiva' and not so_objetivas:
            continue
        for cad in ed['cadernos']:
            local = cad.get('local')
            if not local:
                continue
            indice = json.loads((RAIZ / local['indice']).read_text(encoding='utf-8'))
            arq_gab = RAIZ / 'data' / 'gabaritos' / Path(local['indice']).relative_to('data/questoes')
            gabs = json.loads(arq_gab.read_text(encoding='utf-8'))['questoes'] if arq_gab.exists() else {}
            doc = documentos.setdefault(local['pdf'], fitz.open(RAIZ / local['pdf']))
            parte = local['parte']
            for q in indice['questoes']:
                if q.get('parte', 0) != parte or q['n'] not in local['numeros']:
                    continue
                gab = gabs.get(f"{local['parte']}:{q['n']}")
                fora = not gab if so_objetivas else (bool(gab) or objetiva(q['texto']))
                if fora:  # discursivas e objetivas vão em rodadas separadas
                    ignoradas += 1
                    continue
                apoio = [r for a in indice.get('apoios', []) if a.get('parte', 0) == parte and a['de'] <= q['n'] <= a['ate']
                         for r in a['recortes']]
                chave = f"{local['indice']}#{parte}:{q['n']}"
                # o nome leva a pasta da instituição: famema/2025_prova-i-discursiva e fmj/2025_prova-i-discursiva
                # têm o mesmo nome de arquivo (na 1ª rodada, uma imagem sobrescreveu a outra)
                relativo = Path(local['indice']).relative_to('data/questoes').with_suffix('')
                nome = re.sub(r'[^a-z0-9]+', '-', f"{relativo.as_posix()}-{parte}-{q['n']}".lower()) + '.png'
                renderizar(doc, apoio + q['recortes'], destino / 'imagens' / nome)
                itens.append({
                    'chave': chave,
                    'instituicao': ed['instituicao'],
                    'edicao': ed['edicao'],
                    'caderno': cad['rotulo'],
                    'numero': q['n'],
                    'imagem': (destino / 'imagens' / nome).resolve().as_posix(),
                    'texto_extraido': q['texto'],
                    **({'gabarito': gab} if so_objetivas else {}),
                })

    lotes = [itens[i:i + tamanho] for i in range(0, len(itens), tamanho)]
    for i, lote in enumerate(lotes, 1):
        with open(destino / f'lote-{i:02d}.json', 'w', encoding='utf-8', newline='\n') as saida:
            saida.write(json.dumps(lote, ensure_ascii=False, indent=1))
        edicoes = sorted({f"{x['instituicao'].split(' ')[0]} {x['edicao']}" for x in lote})
        print(f'lote-{i:02d}: {len(lote)} questões — {", ".join(edicoes)}')
    print(f'{len(itens)} discursivas em {len(lotes)} lotes ({ignoradas} objetivas ignoradas) -> {destino}')


if __name__ == '__main__':
    main()
