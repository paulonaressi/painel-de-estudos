# Confere as respostas-modelo entregues (respostas-lote-NN.json) contra os lotes gerados por
# preparar.py e, com --gravar, publica em data/respostas-modelo/ um arquivo por caderno (mesmo
# caminho do índice em data/questoes/) e atualiza data/respostas-modelo/indice.json.
#
# Uso: python3 ferramentas/respostas-modelo/validar.py <pasta do material>
#        --mostrar <trecho da chave> ...   imprime respostas para leitura (ex.: unesp/2026-2_1-dia#0:15)
#        --gravar                          publica (exige todos os lotes sem problemas)
#        --gravar --parcial                publica só os lotes entregues e sem problemas
#
# O que é conferido: mesma ordem e mesmas chaves do lote, resposta preenchida, item a item quando a
# questão tem a), b)…, confiança válida, pendência nas que não são "alta", nada de LaTeX. O conteúdo
# não é conferido: leia uma amostra contra a prova antes de publicar.
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent.parent
CONFIANCAS = {'alta', 'media', 'baixa'}


def ler(caminho):
    return json.loads(Path(caminho).read_text(encoding='utf-8'))


def gravar(caminho, texto):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with open(caminho, 'w', encoding='utf-8', newline='\n') as saida:  # write_text(newline=) só no 3.10+
        saida.write(texto)


def itens_pedidos(texto):
    """Itens a) e b) que aparecem no texto extraído da questão. As discursivas da Vunesp têm esses
    dois; c), d)… costumam ser alíneas de textos citados, então não são exigidos."""
    return sorted(set(re.findall(r'(?:^|\s)([ab])\)\s', texto)))


def conferir(lote, entregue):
    problemas = []
    if len(entregue) != len(lote):
        problemas.append(f'tamanho {len(entregue)} != {len(lote)}')
    for m, r in zip(lote, entregue):
        rotulo = f"{m['instituicao'].split(' ')[0]} {m['edicao']} q{m['numero']}"
        if r.get('chave') != m['chave']:
            problemas.append(f'chave difere em {rotulo}')
            continue
        texto = r.get('resposta') or ''
        if len(texto.split()) < 15:
            problemas.append(f'resposta vazia ou curta em {rotulo}')
        if r.get('confianca') not in CONFIANCAS:
            problemas.append(f'confiança inválida em {rotulo}')
        elif r['confianca'] != 'alta' and not r.get('pendencia'):
            problemas.append(f'falta pendência em {rotulo}')
        if '\\frac' in texto or '$$' in texto or '\\(' in texto or re.search(r'\$[^$\n]+\$', texto):
            problemas.append(f'latex em {rotulo}')
        if m.get('gabarito'):  # objetiva: termina com a letra do gabarito
            final = re.findall(r'\*\*Resposta: ([A-E])\*\*\s*$', texto)
            if not final:
                problemas.append(f'falta a linha **Resposta: X** em {rotulo}')
            elif final[0] != m['gabarito']:
                problemas.append(f'resposta final {final[0]} ≠ gabarito {m["gabarito"]} em {rotulo}')
            continue
        pedidos = itens_pedidos(m['texto_extraido'])
        if len(pedidos) >= 2:
            faltam = [l for l in pedidos if f'**{l})**' not in texto]
            if faltam:
                problemas.append(f"item {', '.join(faltam)} sem marca **x)** em {rotulo}")
    return problemas


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit('uso: python3 ferramentas/respostas-modelo/validar.py <pasta> [--mostrar trecho ...] [--gravar [--parcial]]')
    pasta = Path(args[0])
    lotes = sorted(pasta.glob('lote-*.json'))

    entregues, com_problema = {}, []
    for arq in lotes:
        lote = ler(arq)
        resp = pasta / f'respostas-{arq.name}'
        if not resp.exists():
            print(f'{arq.stem}: não entregue')
            continue
        entregue = ler(resp)
        problemas = conferir(lote, entregue)
        palavras = [len((r.get('resposta') or '').split()) for r in entregue]
        conf = Counter(r.get('confianca') for r in entregue)
        print(f"{arq.stem} {len(entregue)}/{len(lote)} itens | palavras {min(palavras, default=0)} - {max(palavras, default=0)}"
              f" | confiança {dict(conf)} | problemas: {'; '.join(problemas) or 'nenhum'}")
        if problemas:
            com_problema.append(arq.stem)
        else:
            entregues[arq.stem] = entregue

    if '--mostrar' in args:
        trechos = args[args.index('--mostrar') + 1:]
        trechos = [t for t in trechos if not t.startswith('--')]
        for entregue in entregues.values():
            for r in entregue:
                if any(t in r['chave'] for t in trechos):
                    print(f"\n--- {r['chave']} ({r['confianca']}) ---\n{r['resposta']}")
                    if r.get('pendencia'):
                        print(f"[pendência] {r['pendencia']}")

    if '--gravar' in args:
        if (com_problema or len(entregues) < len(lotes)) and '--parcial' not in args:
            sys.exit('faltam lotes ou há problemas: nada gravado (use --parcial para gravar só os lotes bons)')
        por_indice = {}
        for entregue in entregues.values():
            for r in entregue:
                indice, sufixo = r['chave'].split('#')
                por_indice.setdefault(indice, {})[sufixo] = {
                    'resposta': r['resposta'], 'confianca': r['confianca'], 'pendencia': r.get('pendencia')}
        destino = RAIZ / 'data' / 'respostas-modelo'
        for indice, questoes in por_indice.items():
            arquivo = destino / Path(indice).relative_to('data/questoes')
            atual = ler(arquivo)['questoes'] if arquivo.exists() else {}
            atual.update(questoes)
            gravar(arquivo, json.dumps({
                'indice': indice,
                'gerado_em': date.today().isoformat(),
                'origem': 'Geradas por IA (Claude) a partir da imagem do caderno. Não há resposta oficial publicada. Sem revisão humana.',
                'questoes': dict(sorted(atual.items(), key=lambda kv: [int(x) for x in kv[0].split(':')])),
            }, ensure_ascii=False, indent=1))
        arquivo_indice = destino / 'indice.json'
        lista = set(ler(arquivo_indice)) if arquivo_indice.exists() else set()
        lista |= set(por_indice)
        gravar(arquivo_indice, json.dumps(sorted(lista), ensure_ascii=False, indent=1))
        total = sum(len(q) for q in por_indice.values())
        print(f'gravado: {total} respostas em {len(por_indice)} cadernos; {len(lista)} cadernos no índice')


if __name__ == '__main__':
    main()
