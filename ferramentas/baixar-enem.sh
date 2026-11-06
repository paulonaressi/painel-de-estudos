#!/usr/bin/env bash
# Baixa do INEP os cadernos azuis do ENEM e seus gabaritos para provas/enem
# (os anos que a API enem.dev não cobre).
# Uso: bash ferramentas/baixar-enem.sh [ano ...]        padrão: 2024 2025
#
# CD1 (1º dia) e CD7 (2º dia) são os cadernos azuis em 2024 e 2025; confira a cor na capa
# antes de usar em outros anos. Depois de baixar: python3 ferramentas/extrair-questoes.py enem
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p provas/enem

anos=("$@")
[ ${#anos[@]} -eq 0 ] && anos=(2024 2025)

for ano in "${anos[@]}"; do
  for nome in "${ano}_PV_impresso_D1_CD1" "${ano}_GB_impresso_D1_CD1" "${ano}_PV_impresso_D2_CD7" "${ano}_GB_impresso_D2_CD7"; do
    destino="provas/enem/${nome}.pdf"
    if [ -s "$destino" ]; then
      echo "já existe  $destino"
      continue
    fi
    curl -fsS --max-time 300 -A "Mozilla/5.0" -o "$destino" "https://download.inep.gov.br/enem/provas_e_gabaritos/${nome}.pdf"
    if ! head -c 5 "$destino" | grep -q '%PDF-'; then
      echo "a resposta não é um PDF: $destino" >&2
      rm -f "$destino"
      exit 1
    fi
    echo "baixado    $destino"
  done
done
