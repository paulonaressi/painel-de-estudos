# Confere as resoluções entregues (resolucoes-<area>.json) contra os manifestos gerados por
# preparar.py e, com --gravar, publica data/resolucoes/enem-<ano>.json e atualiza o índice.
#
# Uso: python3 ferramentas/resolucoes/validar.py <pasta do material> --ano 2024
#        --mostrar natureza:95 matematica:150   imprime resoluções para leitura
#        --gravar                               publica (exige as quatro áreas sem problemas)
#        --gravar --parcial                     publica só as áreas já entregues
#
# O que é conferido: mesma ordem e mesmas chaves do manifesto, última linha "**Resposta: X**"
# igual ao gabarito oficial, anuladas sem resolução, nada de LaTeX. O conteúdo não é conferido:
# leia uma amostra contra a prova antes de publicar.
import json
import re
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent.parent
AREAS = ['linguagens', 'humanas', 'natureza', 'matematica']
FIM = re.compile(r'[*][*]Resposta:\s*([A-E])[*][*]\s*$')


def ler(caminho):
    return json.loads(Path(caminho).read_text(encoding='utf-8'))


def gravar(caminho, texto):
    with open(caminho, 'w', encoding='utf-8', newline='\n') as saida:  # write_text(newline=) só no 3.10+
        saida.write(texto)


def conferir(manifesto, entregue):
    problemas = []
    if len(entregue) != len(manifesto):
        problemas.append(f'tamanho {len(entregue)} != {len(manifesto)}')
    for m, r in zip(manifesto, entregue):
        if (m['numero'], m['idioma'], m['gabarito']) != (r['numero'], r['idioma'], r['gabarito']):
            problemas.append(f"chave difere em {m['numero']}")
        if m['gabarito'] is None:
            if r['resolucao'] is not None:
                problemas.append(f"anulada {m['numero']} com resolução")
            continue
        texto = r['resolucao'] or ''
        fim = FIM.search(texto)
        if not fim or fim.group(1) != m['gabarito']:
            problemas.append(f"resposta final difere em {m['numero']}")
        if '\\frac' in texto or '$$' in texto or '\\(' in texto:
            problemas.append(f"latex em {m['numero']}")
    return problemas


def main():
    args = sys.argv[1:]
    if not args or '--ano' not in args:
        sys.exit('uso: python3 ferramentas/resolucoes/validar.py <pasta> --ano <ano> [--mostrar area:numero ...] [--gravar [--parcial]]')
    pasta = Path(args[0])
    ano = args[args.index('--ano') + 1]
    ano = int(ano) if ano.isdigit() else ano  # aplicação extra: "2024-reaplicacao", "2025-belem"

    entregues = {}
    completo = True
    for area in AREAS:
        arquivo = pasta / f'resolucoes-{area}.json'
        if not arquivo.exists():
            print(area, 'ainda não entregue')
            completo = False
            continue
        entregue = ler(arquivo)
        problemas = conferir(ler(pasta / f'{area}.json'), entregue)
        palavras = [len(r['resolucao'].split()) for r in entregue if r['resolucao']]
        confianca = {}
        for r in entregue:
            confianca[r['confianca']] = confianca.get(r['confianca'], 0) + 1
        print(area, len(entregue), 'itens | palavras', min(palavras), '-', max(palavras),
              '| confiança', confianca, '| problemas:', problemas or 'nenhum')
        completo = completo and not problemas
        entregues[area] = entregue

    if '--mostrar' in args:
        for item in args[args.index('--mostrar') + 1:]:
            if item.startswith('--'):
                break
            area, numero = item.split(':')
            r = next(x for x in entregues[area] if x['numero'] == int(numero))
            print(f"\n--- {area} Q{numero} (gabarito {r['gabarito']}, {r['confianca']}) ---\n{r['resolucao']}")
            if r['pendencia']:
                print('PENDÊNCIA:', r['pendencia'])

    if '--gravar' in args:
        if not completo and '--parcial' not in args:
            sys.exit('faltam áreas ou há problemas: nada gravado')
        questoes = {}
        for area in AREAS:
            for r in entregues.get(area, []):
                chave = f"{r['numero']}{':' + r['idioma'] if r['idioma'] else ''}"  # mesma chave do fim do id da questão
                questoes[chave] = {'resolucao': r['resolucao'], 'confianca': r['confianca'], 'pendencia': r['pendencia']}
        destino = RAIZ / 'data' / 'resolucoes'
        destino.mkdir(parents=True, exist_ok=True)
        gravar(destino / f'enem-{ano}.json', json.dumps({
            'prova': 'enem',
            'ano': ano,
            'gerado_em': date.today().isoformat(),
            'origem': 'Geradas por IA (Claude) a partir do caderno oficial e do gabarito do INEP. Sem revisão humana.',
            'questoes': questoes,
        }, ensure_ascii=False, indent=1))

        arquivo_indice = destino / 'indice.json'
        indice = ler(arquivo_indice) if arquivo_indice.exists() else {}
        # mais recente primeiro; no mesmo ano, a regular (número) antes das aplicações extras (texto)
        indice['enem'] = sorted(set(indice.get('enem', [])) | {ano}, key=lambda p: (-int(str(p)[:4]), isinstance(p, str), str(p)))
        gravar(arquivo_indice, json.dumps(indice))
        print(f'gravado: {len(questoes)} questões em data/resolucoes/enem-{ano}.json; anos com resolução: {indice["enem"]}')


if __name__ == '__main__':
    main()
