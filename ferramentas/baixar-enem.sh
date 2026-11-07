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

# Até 2019 o INEP usa outros nomes, em educacao_basica/enem/{provas,gabaritos}/<ano>/ (lidos da página
# "Provas e gabaritos" do INEP em 07/11/2026). Ordem: prova 1º dia, gabarito 1º dia, prova 2º dia, gabarito 2º dia.
antigo() {
  case "$1" in
    2019) echo "caderno_de_questoes_1_dia_caderno_1_azul_aplicacao_regular gabarito_1_dia_caderno_1_azul_aplicacao_regular caderno_de_questoes_2_dia_caderno_7_azul_aplicacao_regular gabarito_2_dia_caderno_7_azul_aplicacao_regular" ;;
    2018) echo "2018_PV_impresso_D1_CD1 GAB_ENEM_2018_DIA_1_AZUL 2018_PV_impresso_D2_CD7 GAB_ENEM_2018_DIA_2_AZUL" ;;
    2017) echo "2017_PV_impresso_D1_CD1 cad_1_gabarito_azul_5112017 2017_PV_impresso_D2_CD7 cad_7_gabarito_azul_12112017" ;;
    2016) echo "2016_PV_impresso_D1_CD1 GAB_ENEM_2016_DIA_1_01_AZUL 2016_PV_impresso_D2_CD7 GAB_ENEM_2016_DIA_2_07_AZUL" ;;
    2015|2014) echo "$1_PV_impresso_D1_CD1 CADERNO_1_AZUL_SABADO $1_PV_impresso_D2_CD7 CADERNO_7_AZUL_DOMINGO" ;;
    2013|2012) echo "dia1_caderno1_azul dia1_azul dia2_caderno7_azul dia2_azul" ;;
    2011) echo "dia1_caderno1_azul 01_AZUL_GABARITO dia2_caderno7_azul 07_AZUL_GABARITO" ;;
    2010) echo "dia1_caderno1_azul provas/2010/dia1_caderno1_azul_com_gab dia2_caderno7_azul provas/2010/dia2_caderno7_azul_com_gab" ;;  # gabarito no fim do caderno
    2009) echo "dia1_caderno1_azul gabarito_dia1 dia2_caderno7_azul gabarito_dia2" ;;
    *) echo "" ;;
  esac
}

for ano in "${anos[@]}"; do
  remotos=($(antigo "$ano"))
  i=0
  for nome in "${ano}_PV_impresso_D1_CD1" "${ano}_GB_impresso_D1_CD1" "${ano}_PV_impresso_D2_CD7" "${ano}_GB_impresso_D2_CD7"; do
    destino="provas/enem/${nome}.pdf"
    if [ ${#remotos[@]} -eq 4 ]; then
      pasta=$([ $((i % 2)) -eq 0 ] && echo provas || echo gabaritos)
      url="https://download.inep.gov.br/educacao_basica/enem/${pasta}/${ano}/${remotos[$i]}.pdf"
      case "${remotos[$i]}" in */*) url="https://download.inep.gov.br/educacao_basica/enem/${remotos[$i]}.pdf" ;; esac
    else
      url="https://download.inep.gov.br/enem/provas_e_gabaritos/${nome}.pdf"
    fi
    i=$((i + 1))
    if [ -s "$destino" ]; then
      echo "já existe  $destino"
      continue
    fi
    curl -fsS --max-time 300 -A "Mozilla/5.0" -o "$destino" "$url"
    if ! head -c 5 "$destino" | grep -q '%PDF-'; then
      echo "a resposta não é um PDF: $destino" >&2
      rm -f "$destino"
      exit 1
    fi
    echo "baixado    $destino"
  done
done
