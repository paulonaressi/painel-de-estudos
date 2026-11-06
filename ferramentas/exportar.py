# Empacota o projeto para levar a outra máquina. Gera dois arquivos em exportar/:
#   banco-de-questoes-completo.zip     tudo, inclusive os PDFs de provas/ (não precisa baixar nada)
#   banco-de-questoes-sem-provas.zip   código e dados; os PDFs são baixados de novo pelos scripts
# Antes de empacotar, converte os arquivos de texto para fim de linha LF.
# Uso: python3 ferramentas/exportar.py
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
NOME = 'banco-de-questoes'
FORA = {'exportar', 'trabalho', '__pycache__', '.git', 'node_modules'}
TEXTO = {'.py', '.js', '.json', '.html', '.css', '.md', '.sh', '.txt', '.gitignore'}


def arquivos():
    for caminho in sorted(RAIZ.rglob('*')):
        relativo = caminho.relative_to(RAIZ)
        if caminho.is_file() and not FORA.intersection(relativo.parts) and caminho.name != '.DS_Store':
            yield caminho, relativo


def normalizar_fim_de_linha():
    convertidos = 0
    for caminho, _ in arquivos():
        if caminho.suffix not in TEXTO and caminho.name not in TEXTO:
            continue
        bruto = caminho.read_bytes()
        if b'\r\n' in bruto:
            caminho.write_bytes(bruto.replace(b'\r\n', b'\n'))
            convertidos += 1
    return convertidos


def empacotar(destino, incluir_pdfs):
    total = 0
    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as pacote:
        for caminho, relativo in arquivos():
            if caminho.suffix == '.pdf' and not incluir_pdfs:
                continue
            pacote.write(caminho, (Path(NOME) / relativo).as_posix())
            total += 1
    with zipfile.ZipFile(destino) as pacote:
        corrompido = pacote.testzip()
    if corrompido:
        raise SystemExit(f'arquivo corrompido no pacote: {corrompido}')
    print(f'{destino.name}: {total} arquivos, {destino.stat().st_size / 1e6:.1f} MB')


if __name__ == '__main__':
    print(f'{normalizar_fim_de_linha()} arquivos convertidos para LF')
    saida = RAIZ / 'exportar'
    saida.mkdir(exist_ok=True)
    empacotar(saida / f'{NOME}-completo.zip', incluir_pdfs=True)
    empacotar(saida / f'{NOME}-sem-provas.zip', incluir_pdfs=False)
