// Classificação automática das questões por disciplina e assunto, por palavras-chave.
// É uma estimativa: acerta a maioria, mas erra em questões interdisciplinares ou de enunciado curto.
//
// Formato das listas: termos separados por espaço, "termo:peso" (peso 1 se omitido).
// "_" vale espaço; "$" no fim exige a palavra inteira; sem "$" casa o começo da palavra.
// Tudo sem acento e em minúsculas.
(function () {
  'use strict';

  const BQ = (window.BQ = window.BQ || {});

  const DISCIPLINAS = [
    {
      id: 'portugues', nome: 'Português', areas: ['linguagens'], geral: 'Interpretação de texto',
      termos: `variacao_linguistica:3 variedade_linguistica:3 norma_padrao:3 norma_culta:3 lingua_portuguesa:2 linguistic:2
        genero_textual:3 generos_textuais:3 funcao_da_linguagem:3 funcao_referencial:3 funcao_conativa:3 funcao_metalinguistica:3
        campanha:2 anuncio:2 publicidade:2 publicitari:2 propaganda:2 cartaz:2 tirinha:1.5 charge:1.5 noticia:1.5 reportagem:1.5
        editorial:2 artigo_de_opiniao:3 argument:1.5 coesao:3 coerencia:2.5 conectivo:3 pronome:3 verbo$:2 sintax:3 morfolog:3
        semantic:2 ortograf:3 pontuacao:3 regionalismo:2.5 giria:3 oralidade:3 internet:1.5 redes_sociais:1.5 hipertexto:3
        interlocutor:2.5 leitor:1 preconceito_linguistico:3 sotaque:3 dialeto:2.5 libras$:2.5 intertextual:2 persuas:2 dicionario:2
        verbete:3 tecnologias_de_informacao:2.5 tecnologias_da_informacao:2.5 comunicacao:1 digital:1 infografico:2 texto_jornalistico:3
        divulgacao_cientifica:2.5 resenha:2 e-mail:1.5 blog:2 linguagem_verbal:2 linguagem_nao_verbal:2.5 marcas_linguisticas:3
        recursos_linguisticos:2.5 vocabulario:1.5 palavra:0.5 expressao:0.5`,
      assuntos: {
        'Variação linguística': 'variacao_linguistica:3 variedade_linguistica:3 norma_padrao:2 norma_culta:2 regionalismo:2 giria:2 oralidade:2 preconceito_linguistico:3 sotaque:2 dialeto:2 informal coloquial',
        'Gêneros textuais e publicidade': 'campanha:2 anuncio:2 publicidade:2 publicitari:2 propaganda:2 cartaz:2 genero_textual:2 generos_textuais:2 noticia reportagem editorial artigo_de_opiniao:2 resenha carta$ infografico tirinha charge',
        'Gramática e coesão': 'coesao:2 coerencia:2 conectivo:2 pronome:2 verbo$:2 sintax:2 morfolog:2 ortograf:2 pontuacao:2 conjunc:2 adjetivo:2 substantivo:2 oracao concordancia:2 crase:2',
        'Tecnologia e comunicação': 'internet:2 redes_sociais:2 hipertexto:3 digital tecnolog blog e-mail aplicativo virtual online',
        'Funções da linguagem': 'funcao_da_linguagem:3 funcoes_da_linguagem:3 funcao_referencial:3 funcao_conativa:3 funcao_metalinguistica:3 funcao_poetica:3 funcao_emotiva:3 funcao_fatica:3',
      },
    },
    {
      id: 'literatura', nome: 'Literatura', areas: ['linguagens'], geral: 'Texto literário',
      termos: `poema:3 poeta:2.5 poesia:2.5 poetic:2 romance$:2 romances$:2 conto$:2 contos$:2 narrador:3 personagem:2 personagens:2
        verso$:2.5 versos$:2.5 estrofe:3 soneto:3 eu_lirico:3 modernis:3 romantis:3 realismo:2 naturalismo:2.5 barroc:3 arcadis:3
        parnasian:3 simbolis:2.5 literari:2.5 literatura:2.5 machado_de_assis:3 drummond:3 clarice_lispector:3 guimaraes_rosa:3
        fernando_pessoa:3 camoes:3 gregorio_de_matos:3 jose_de_alencar:3 graciliano:3 manuel_bandeira:3 cecilia_meireles:3
        oswald_de_andrade:3 mario_de_andrade:3 joao_cabral:3 ficcao:1.5 prosa$:2 lirismo:3 liric:2 cronica:1.5 semana_de_arte_moderna:3
        cordel:2 euclides_da_cunha:3 lima_barreto:3 jorge_amado:3 eca_de_queiros:3 saramago:3 castro_alves:3 goncalves_dias:3
        alvares_de_azevedo:3 olavo_bilac:3 cruz_e_sousa:3 augusto_dos_anjos:3 rachel_de_queiroz:3 erico_verissimo:3 ferreira_gullar:3
        vinicius_de_moraes:3 mia_couto:3 conceicao_evaristo:3 carolina_maria_de_jesus:3 rubem_fonseca:3 adelia_prado:3
        manoel_de_barros:3 paulo_leminski:3 hilda_hilst:3 lygia_fagundes:3 nova_aguilar:2 obra_completa:1.5 poesia_completa:3
        companhia_das_letras:1.5 jose_olympio:1.5`,
      assuntos: {
        'Poesia': 'poema:2 poeta poesia verso$:2 versos$:2 estrofe:2 soneto:2 eu_lirico:2 liric rima',
        'Prosa e narrativa': 'romance$:2 conto$:2 contos$:2 narrador:2 personagem personagens cronica:2 ficcao prosa$ enredo',
        'Modernismo': 'modernis:3 semana_de_arte_moderna:3 oswald_de_andrade:3 mario_de_andrade:3 manuel_bandeira:2 drummond:2',
        'Romantismo e Realismo': 'romantis:3 realismo:3 naturalismo:3 machado_de_assis:3 jose_de_alencar:3 castro_alves:3 goncalves_dias:3 eca_de_queiros:3',
        'Barroco e Arcadismo': 'barroc:3 arcadis:3 gregorio_de_matos:3 padre_antonio_vieira:3 tomas_antonio_gonzaga:3',
      },
    },
    {
      id: 'artes', nome: 'Artes', areas: ['linguagens'], geral: 'Outros',
      termos: `pintura:3 pintor:3 escultura:3 escultor:3 artista:2 artistas:2 arte$:1.5 artes$:1.5 obra_de_arte:3 museu:2 exposicao:1.5
        instalacao:1.5 performance:2 danca:2.5 musica$:1.5 musical:1.5 cancao:1.5 teatro:2.5 teatral:2.5 cinema:2 filme:1.5
        fotografia:1.5 grafite:2.5 estetic:1.5 arquitet:2 artesanato:2 xilogravura:3 gravura:2.5 cubis:3 surrealis:3 impressionis:3
        expressionis:3 dadais:3 tarsila:3 portinari:3 di_cavalcanti:3 anita_malfatti:3 helio_oiticica:3 lygia_clark:3 picasso:3
        coreograf:3 espetaculo:2 cenic:3 melodia:2.5 instrumento_musical:3 instrumentos_musicais:3 patrimonio_cultural:2
        arte_contemporanea:3 arte_urbana:3 artes_visuais:3 artes_plasticas:3 oleo_sobre_tela:3 bienal:3 tropicalia:2.5 bossa_nova:2.5
        compositor:2 orquestra:3 opera$:2.5 bale$:3 circo:2.5 cenografia:3 vanguarda:2 masp$:3 pinacoteca:3 samba:1.5 rap$:1.5
        hip_hop:2 maracatu:2.5 frevo:2.5 jazz:2`,
      assuntos: {
        'Artes visuais': 'pintura:2 pintor:2 escultura:2 fotografia grafite:2 gravura:2 instalacao museu exposicao tela$ quadro$ desenho arquitet artes_visuais:2 artes_plasticas:2',
        'Música': 'musica$:2 musical cancao:2 melodia:2 compositor:2 samba rap$ instrumento orquestra:2 ritmo',
        'Teatro, dança e cinema': 'teatro:2 teatral:2 danca:2 coreograf:2 cinema:2 filme espetaculo cenic:2 circo bale$ performance',
      },
    },
    {
      id: 'edfisica', nome: 'Educação Física', areas: ['linguagens'], geral: 'Corpo e práticas corporais',
      termos: `esporte:3 esportiv:3 atleta:2.5 exercicio_fisico:3 exercicios_fisicos:3 atividade_fisica:3 atividades_fisicas:3
        corporal:2.5 corporais:2.5 ginastica:3 futebol:2.5 jogos_olimpicos:3 olimpi:2.5 paralimpi:3 sedentar:3 obesidade:2
        lazer:1.5 capoeira:2.5 treinamento:2 doping:3 condicionamento:2.5 musculac:3 volei:3 basquete:3 natacao:3 maratona:2.5
        anabolizante:3 educacao_fisica:3 corpo$:1.5 corpos$:1.5 padrao_de_beleza:2 padroes_de_beleza:2 saude$:1 jogo$:1 jogos$:1
        brincadeira:2 lutas$:2 judo:3 skate:2.5 surfe:2.5 atletismo:3 handebol:3 torcida:2 torcedor:2 aptidao_fisica:3
        frequencia_cardiaca:2 alongamento:3 postura:1.5 competic:1.5`,
      assuntos: {
        'Esportes': 'esporte:2 esportiv:2 atleta:2 futebol:2 olimpi:2 paralimpi:2 volei basquete natacao atletismo competic torcida',
        'Saúde e atividade física': 'exercicio:2 atividade_fisica:2 atividades_fisicas:2 sedentar:2 obesidade:2 saude$ condicionamento:2 aptidao_fisica:2 doping anabolizante',
        'Corpo e cultura': 'corpo$:2 corpos$:2 corporal:2 corporais:2 padrao_de_beleza:3 padroes_de_beleza:3 danca capoeira:2 lutas$ brincadeira:2 lazer',
      },
    },
    {
      id: 'ingles', nome: 'Inglês', areas: ['linguagens'], geral: 'Interpretação de texto',
      termos: 'the$ and$ of$ is$ that$ with$ for$ this$ are$ was$ from$ have$ not$ to$:0.5 lingua_inglesa:3 ingles$:2',
      assuntos: {},
    },
    {
      id: 'espanhol', nome: 'Espanhol', areas: ['linguagens'], geral: 'Interpretação de texto',
      termos: 'el$:1.5 los$:1.5 las$:1.5 del$:1.5 una$:1.5 pero$:2 muy$:2 hay$:2 y$ espanol:3 lingua_espanhola:3',
      assuntos: {},
    },
    {
      id: 'historia', nome: 'História', areas: ['humanas'], geral: 'Outros',
      termos: `seculo:1 revoluc:2 imperio$:2 imperial:2 colonia$:2 colonias$:2 colonial:2 coloniz:2 escrav:2.5 monarqui:2.5 ditadura:2.5
        golpe:2 guerra$:1.5 guerras$:1.5 feudal:3 idade_media:3 medieval:3 renasciment:2 revolucao_francesa:3 revolucao_industrial:2.5
        era_vargas:3 getulio:3 vargas$:2 estado_novo:3 regime_militar:3 ai-5:3 abolic:3 independencia:2 coroa_portuguesa:3 jesuita:3
        bandeirante:3 quilombo$:2 quilombos$:2 nazis:3 fascis:3 guerra_fria:3 primeira_guerra:3 segunda_guerra:3 uniao_sovietica:2.5
        urss$:2.5 absolutis:3 mercantilis:3 burgues:2 reforma_protestante:3 cruzadas:2.5 roma_antiga:3 romano:1.5 grecia_antiga:2
        egito:2 egipci:2 mesopotami:3 incas$:2.5 astecas$:2.5 oligarqui:3 coronelis:3 cafe_com_leite:3 republica_velha:3
        primeira_republica:3 imperador:2.5 d_pedro:3 dom_pedro:3 historiador:3 historiografi:3 antiguidade:2.5 populis:2.5
        kubitschek:3 inconfidencia:3 canudos:3 tenentis:3 imperialis:2.5 apartheid:2.5 descoloniz:2.5 capitanias:3 engenho:2
        senzala:3 trafico_negreiro:3 lei_aurea:3 proclamacao_da_republica:3 guerra_do_paraguai:3 revolta:2 rebeliao:2 insurreic:2.5
        cabanagem:3 farroupilha:3 balaiada:3 sabinada:3 conjuracao:3 corte_portuguesa:3 familia_real:2.5 periodo_regencial:3
        segundo_reinado:3 primeiro_reinado:3 anistia:2 diretas_ja:3 redemocratiz:2.5 constituinte:2 anos_de_chumbo:3 censura:1.5
        holocausto:3 hitler:3 mussolini:3 stalin:3 napole:3 bolchevi:3 revolucao_russa:3 crise_de_1929:3 new_deal:3 muro_de_berlim:3
        revolucao_cubana:3 iluminis:1.5 antigo_regime:3 inquisicao:3 expansao_maritima:3 grandes_navegacoes:3 tordesilhas:3
        ciclo_do_ouro:3 cafeicultura:2 barao:2 nobreza:2.5 clero:2.5 servos$:2.5 vassal:3 suserano:3 farao:3 atenas:2 esparta:3
        helenis:3 bizantin:3 califado:3 otomano:3 conquista_espanhola:3 plantation:3 fonte_historica:3 memoria:1`,
      assuntos: {
        'Brasil Colônia': 'colonia$:2 colonial:2 coloniz:2 jesuita:2 bandeirante:2 capitanias:3 engenho:2 senzala:2 coroa_portuguesa:2 inconfidencia:3 conjuracao:3 pau-brasil:2 ciclo_do_ouro:3 tordesilhas:2 america_portuguesa:3 trafico_negreiro:2 quilombo$ quilombos$ palmares:2',
        'Brasil Império': 'imperio$ imperial d_pedro:3 dom_pedro:3 primeiro_reinado:3 segundo_reinado:3 periodo_regencial:3 regencia:2 guerra_do_paraguai:3 cabanagem:3 farroupilha:3 balaiada:3 sabinada:3 abolic:2 lei_aurea:3 corte_portuguesa:2 familia_real:2 cafeicultura:2 barao lei_de_terras:3',
        'Brasil República': 'republica_velha:3 primeira_republica:3 coronelis:3 oligarqui:2 cafe_com_leite:3 canudos:3 tenentis:3 era_vargas:3 getulio:3 vargas$:2 estado_novo:3 populis:2 kubitschek:3 regime_militar:3 ditadura:2 ai-5:3 anistia:2 diretas_ja:3 redemocratiz:2 constituinte:2 anos_de_chumbo:3 proclamacao_da_republica:3 revolta_da_vacina:3 contestado:3 cangac:3 constituicao_de_1988:3',
        'Antiguidade e Idade Média': 'antiguidade:2 roma_antiga:3 romano:2 grecia_antiga:3 atenas:2 esparta:2 egito:2 egipci:2 mesopotami:3 farao:2 helenis:2 feudal:3 idade_media:3 medieval:3 vassal:3 suserano:3 servos$:2 cruzadas:2 bizantin:3 califado:2 clero nobreza',
        'Idade Moderna': 'renasciment:2 absolutis:3 mercantilis:3 reforma_protestante:3 inquisicao:2 expansao_maritima:3 grandes_navegacoes:3 iluminis:2 antigo_regime:3 revolucao_francesa:3 napole:2 revolucao_inglesa:3 incas$:2 astecas$:2 conquista_espanhola:3 revolucao_industrial:2',
        'Idade Contemporânea': 'primeira_guerra:3 segunda_guerra:3 guerra_fria:3 nazis:3 fascis:3 hitler:3 mussolini:3 stalin:3 holocausto:3 uniao_sovietica:2 urss$:2 revolucao_russa:3 bolchevi:3 crise_de_1929:3 new_deal:3 muro_de_berlim:3 revolucao_cubana:3 imperialis:2 apartheid:2 descoloniz:2 neocolonial:2 seculo_xx vietna:2',
      },
    },
    {
      id: 'geografia', nome: 'Geografia', areas: ['humanas'], geral: 'Outros',
      termos: `clima$:2 climas$:2 climatic:2 relevo:3 bacia_hidrografica:3 bacias_hidrograficas:3 urbaniz:3 urbano:1.5 urbana:1.5
        urbanos:1.5 urbanas:1.5 metropol:2 territori:1.5 demograf:3 migrac:2 migrator:2.5 agricultura:2 agricola:2 agronegocio:3
        agropecuari:2.5 solo$:1.5 solos$:1.5 erosao:2.5 desmatamento:2 bioma:2 cerrado:2 amazonia:1.5 caatinga:2 mata_atlantica:1.5
        pantanal:2 chuva:1 pluviometr:3 precipitac:1.5 massa_de_ar:3 massas_de_ar:3 el_nino:3 la_nina:3 latitude:3 longitude:3
        cartograf:3 mapa$:2 mapas$:2 fuso_horario:3 fusos_horarios:3 globalizac:2.5 geopolitic:3 fronteira:1.5 industrializac:2
        pib$:2 idh$:3 exportac:1.5 commodit:2.5 bloco_economico:3 blocos_economicos:3 mercosul:3 uniao_europeia:2 tectonic:3
        vulcan:2.5 terremoto:2.5 sismic:2.5 rocha:2 minerio:2 hidrografi:3 aquifero:3 recursos_hidricos:2.5 matriz_energetica:2.5
        espaco_geografico:3 paisagem:2 rural:2 exodo_rural:3 favela:2 socioespacial:3 periferi:1.5 rede_urbana:3 conurbac:3
        logistic:1.5 reforma_agraria:3 latifundi:3 fundiari:3 fronteira_agricola:3 semiarido:2.5 desertificac:3 ilha_de_calor:3
        ilhas_de_calor:3 inversao_termica:3 aquecimento_global:2 mudancas_climaticas:2.5 refugiad:2 oriente_medio:2 regionalizac:3
        ibge$:2.5 geograf:3 lencol_freatico:3 assoreamento:3 mata_ciliar:3 enchente:2 inundac:2 deslizamento:2.5 saneamento:2
        residuos_solidos:2 densidade_demografica:3 taxa_de_natalidade:3 fecundidade:3 piramide_etaria:3 transicao_demografica:3
        populacao:1.5 populacional:2 censo:2.5 rodovia:1.5 ferrovia:2 hidrovia:3 transnacional:2.5 multinacional:2 neoliberal:2
        desindustrializac:3 zona_franca:3 monocultura:2.5 soja:2 pecuaria:2 irrigac:2 transposic:3 hidreletrica:1.5 eolica:1.5
        pre-sal:2.5 gentrificac:3 mobilidade_urbana:2.5 especulacao_imobiliaria:3 verticalizac:3 meridiano:3 hemisferio:2.5
        planalto:3 planicie:3 intemperismo:3 sediment:2 litoral:1.5 costeir:2 manguezal:2 oceano:1.5 corrente_maritima:3
        moncoes:3 tundra:3 savana:2.5 taiga:3 brics$:3 sustentab:1 unidade_de_conservacao:2`,
      assuntos: {
        'Geografia física': 'clima$:2 climas$:2 climatic:2 relevo:3 bacia_hidrografica:3 hidrografi:3 massa_de_ar:3 massas_de_ar:3 el_nino:3 la_nina:3 tectonic:3 vulcan:2 terremoto:2 sismic:2 rocha:2 solo$:2 solos$:2 erosao:2 intemperismo:3 sediment:2 planalto:3 planicie:3 pluviometr:3 precipitac chuva aquifero:2 lencol_freatico:2 litoral oceano corrente_maritima:3 bioma:2 cerrado:2 caatinga:2 pantanal:2 vegetac:2',
        'Meio ambiente': 'desmatamento:2 aquecimento_global:3 mudancas_climaticas:3 efeito_estufa:2 desertificac:3 ilha_de_calor:3 ilhas_de_calor:3 inversao_termica:3 poluic:2 residuos:2 lixo:2 saneamento:2 assoreamento:2 mata_ciliar:2 enchente:2 inundac:2 deslizamento:2 sustentab:2 unidade_de_conservacao:2 impacto_ambiental:2 impactos_ambientais:2 queimada:2',
        'Urbanização': 'urbaniz:3 urbano urbana urbanos urbanas metropol:2 favela:2 socioespacial:3 periferi:2 rede_urbana:3 conurbac:3 gentrificac:3 mobilidade_urbana:3 especulacao_imobiliaria:3 verticalizac:3 cidade$ cidades$ moradia:2',
        'População e migrações': 'demograf:3 migrac:2 migrator:2 densidade_demografica:3 natalidade:2 fecundidade:3 envelhecimento:2 piramide_etaria:3 transicao_demografica:3 populacao populacional:2 censo:2 refugiad:2 imigra:2',
        'Agropecuária e questão agrária': 'agricultura:2 agricola:2 agronegocio:3 agropecuari:3 rural:2 exodo_rural:3 reforma_agraria:3 latifundi:3 fundiari:3 fronteira_agricola:3 monocultura:2 soja:2 pecuaria:2 irrigac:2 agrotoxico:2 campones:2 agricultura_familiar:3',
        'Economia e globalização': 'globalizac:3 industrializac:2 pib$:2 exportac:2 importac:2 commodit:2 bloco_economico:3 blocos_economicos:3 mercosul:3 uniao_europeia:2 transnacional:2 multinacional:2 neoliberal:2 desindustrializac:3 zona_franca:3 logistic:2 rodovia ferrovia hidrovia comercio',
        'Geopolítica': 'geopolitic:3 fronteira:2 oriente_medio:3 conflito:2 conflitos:2 brics$:3 china$:2 russia$:2 estados_unidos otan$:3 onu$:2 separatis:3',
        'Cartografia': 'cartograf:3 mapa$:2 mapas$:2 escala$:2 latitude:3 longitude:3 fuso_horario:3 fusos_horarios:3 meridiano:3 projecao:2 coordenadas_geograficas:3',
        'Energia e recursos naturais': 'matriz_energetica:3 hidreletrica:2 eolica:2 petroleo:2 pre-sal:3 energia minerio:2 mineracao:2 recursos_hidricos:3 transposic:3 biocombust:2',
      },
    },
    {
      id: 'filosofia', nome: 'Filosofia', areas: ['humanas'], geral: 'Ética, política e conhecimento',
      termos: `filosof:3 socrates:3 platao:3 platonic:3 aristotel:3 kant:3 descartes:3 cartesian:3 nietzsche:3 hegel:2.5 rousseau:2
        hobbes:2.5 locke:2.5 maquiavel:2.5 sartre:3 foucault:2 hume$:3 epicur:3 estoic:3 sofista:3 pre-socratic:3 metafisic:3
        epistemolog:3 etic:2 moral$:1.5 morais$:1.5 moralidade:2 virtude:2.5 existencialis:3 empiris:3 racionalis:3 dialetic:2
        contrato_social:3 estado_de_natureza:3 imperativo_categorico:3 caverna:2.5 ontolog:3 fenomenolog:3 agostinho:3
        tomas_de_aquino:3 escolastic:3 habermas:2.5 arendt:2.5 adorno:2 utilitaris:3 livre-arbitrio:3 livre_arbitrio:3 ceticis:3
        cetico:2.5 logos$:3 polis$:2 pensador:1.5 spinoza:3 espinosa:3 francis_bacon:3 heraclito:3 parmenides:3 schopenhauer:3
        heidegger:3 wittgenstein:3 popper:3 montaigne:3 voltaire:2 montesquieu:2 leviata:3 razao$:1.5 racional:1 verdade$:1
        conhecimento:1 entendimento:1.5 sabedoria:2 felicidade:1.5 liberdade:1 justica:1 dever$:1.5 bem_comum:1.5
        mundo_sensivel:3 mundo_inteligivel:3 a_priori:3 cogito:3 duvida_metodica:3 vontade_de_poder:3 niilis:3
        simone_de_beauvoir:2.5 walter_benjamin:2.5 escola_de_frankfurt:2.5 pascal$:2 leibniz:3 tales_de_mileto:3 democrito:3
        seneca:3 marco_aurelio:3 mito$:1.5 contratualis:3 jusnaturalis:3 direito_natural:2.5 eudaimonia:3 alma$:1.5
        os_pensadores:3 abril_cultural:2`,
      assuntos: {
        'Filosofia antiga': 'socrates:3 platao:3 platonic:3 aristotel:3 sofista:3 pre-socratic:3 epicur:3 estoic:3 heraclito:3 parmenides:3 tales_de_mileto:3 democrito:3 seneca:3 marco_aurelio:3 polis$:2 caverna:2 eudaimonia:3 mito$',
        'Filosofia medieval': 'agostinho:3 tomas_de_aquino:3 escolastic:3 patristic:3',
        'Filosofia moderna': 'descartes:3 cartesian:3 kant:3 hume$:3 locke:3 hobbes:3 rousseau:3 maquiavel:3 spinoza:3 espinosa:3 francis_bacon:3 leibniz:3 pascal$:2 montaigne:3 voltaire:2 montesquieu:2 empiris:2 racionalis:2 contrato_social:2 estado_de_natureza:2 imperativo_categorico:3 iluminis:2 cogito:3 leviata:3',
        'Filosofia contemporânea': 'nietzsche:3 hegel:3 marx:2 sartre:3 foucault:3 habermas:3 arendt:3 adorno:3 schopenhauer:3 heidegger:3 wittgenstein:3 popper:3 existencialis:3 fenomenolog:3 simone_de_beauvoir:3 walter_benjamin:3 escola_de_frankfurt:3 niilis:3 utilitaris:2',
      },
    },
    {
      id: 'sociologia', nome: 'Sociologia', areas: ['humanas'], geral: 'Outros',
      termos: `sociolog:3 durkheim:3 weber$:3 weberian:3 marx:2 marxis:2 bourdieu:3 bauman:3 desigualdade:1.5 desigualdades:1.5
        classe_social:2.5 classes_sociais:2.5 movimento_social:2.5 movimentos_sociais:2.5 identidade:1.5 genero$:1.5 racismo:2
        racial:1.5 raciais:1.5 preconceito:1.5 discriminac:1.5 cidadania:2 direitos_humanos:2 democracia:1.5 ideologi:2 alienac:2
        industria_cultural:3 consumis:2 consumo$:1 precarizac:2.5 uberizac:3 capitalis:1.5 socializac:3 fato_social:3
        fatos_sociais:3 acao_social:3 anomia:3 estratificac:3 mobilidade_social:3 etnocentris:3 relativismo_cultural:3
        diversidade_cultural:2 minorias:2 feminis:2.5 violencia:1 redes_sociais:1.5 juventude:1 exclusao:1.5 politicas_publicas:1.5
        participacao_politica:2 opiniao_publica:2 antropolog:2.5 etnia:1.5 etnic:1.5 patriarca:2.5 meritocracia:2.5 habitus:3
        capital_cultural:3 modernidade_liquida:3 sociedade_de_consumo:2.5 vigilancia:1.5 mais-valia:3 mais_valia:3
        luta_de_classes:3 proletari:2.5 burocracia:2 dominacao:2 carismatic:3 solidariedade_mecanica:3 solidariedade_organica:3
        divisao_do_trabalho:2 fordis:2.5 toyotis:3 tayloris:3 flexibilizac:2 desemprego:1.5 informalidade:2 trabalhador:1
        sindicat:2 terceirizac:2.5 cotas$:2 acoes_afirmativas:3 lgbt:2.5 homofobia:2.5 machis:2.5 feminicidio:2.5
        violencia_domestica:2 maria_da_penha:2.5 encarcerament:2.5 sistema_prisional:2.5 welfare:3 sociedade_civil:2 midia:1
        fake_news:2 cultura_de_massa:3 indigena:1 indigenas:1 quilombola:1.5 gilberto_freyre:3 sergio_buarque:3
        florestan_fernandes:3 darcy_ribeiro:2.5 norbert_elias:3 giddens:3 goffman:3 castells:3 simmel:3 comte$:3 positivis:2.5
        instituicoes_sociais:3 controle_social:3 estigma:2.5 tribos_urbanas:3`,
      assuntos: {
        'Clássicos da sociologia': 'durkheim:3 weber$:3 weberian:3 marx:2 marxis:2 fato_social:3 fatos_sociais:3 acao_social:3 anomia:3 mais-valia:3 mais_valia:3 luta_de_classes:3 solidariedade_mecanica:3 solidariedade_organica:3 comte$:3 positivis:2',
        'Cultura e identidade': 'cultura$ cultural identidade:2 etnocentris:3 relativismo:2 diversidade:2 antropolog:2 etnia:2 etnic:2 indigena indigenas quilombola:2 industria_cultural:3 cultura_de_massa:3 consumis:2 midia tribos_urbanas:3',
        'Trabalho e desigualdade': 'trabalho$ trabalhador precarizac:3 uberizac:3 fordis:3 toyotis:3 tayloris:3 flexibilizac:2 desemprego:2 informalidade:2 sindicat:2 terceirizac:3 desigualdade:2 desigualdades:2 classe_social:2 classes_sociais:2 estratificac:3 mobilidade_social:3 meritocracia:3 capitalis pobreza:2',
        'Gênero, raça e direitos': 'genero$:2 racismo:3 racial:2 raciais:2 preconceito:2 discriminac:2 feminis:3 machis:3 feminicidio:3 lgbt:3 homofobia:3 cotas$:2 acoes_afirmativas:3 direitos_humanos:2 violencia minorias:2 maria_da_penha:3',
        'Política e cidadania': 'cidadania:2 democracia:2 democratic movimento_social:3 movimentos_sociais:3 participacao_politica:3 politicas_publicas:2 sociedade_civil:2 partido voto eleic:2 opiniao_publica:2',
      },
    },
    {
      id: 'fisica', nome: 'Física', areas: ['natureza', 'natureza-matematica'], geral: 'Outros',
      termos: `velocidade:2 aceleracao:3 forca$:1.5 forcas$:1.5 newton:3 joule:3 watt:2 volt$:2 volts$:2 tensao_eletrica:3
        corrente_eletrica:3 resistor:3 resistencia_eletrica:3 circuito:2.5 capacitor:3 campo_magnetico:3 campo_eletrico:3
        carga_eletrica:3 cargas_eletricas:3 onda$:2 ondas$:2 frequencia:1.5 comprimento_de_onda:3 lente:3 espelho:2 refrac:3
        reflexao:1.5 difrac:3 calor$:1.5 termic:1.5 termodinamic:3 dilatac:3 pressao:1.5 empuxo:3 hidrostatic:3 gravidade:2
        gravitac:3 orbita:2 satelite:1.5 queda_livre:3 atrito:3 colisao:2 quantidade_de_movimento:3 energia_cinetica:3
        energia_potencial:3 energia_mecanica:3 eletromagnet:3 raios_x:2 fissao:2 fusao_nuclear:3 efeito_fotoeletrico:3 foton:3
        km/h:2 m/s:3 kwh:2.5 chuveiro:2 lampada:1.5 transformador:3 gerador:2 ultrassom:2 ressonancia:2 acustic:2 pendulo:3
        mola$:2.5 torque:3 alavanca:3 vazao:2 ampere:3 ohm:3 hertz:3 decibel:3 trajetoria:2 inercia:3 potencia$:1.5
        potencia_eletrica:3 eletricidade:2 eletric:1 magnetic:2 ima$:2.5 imas$:2.5 bobina:3 optic:2 fibra_optica:2.5 laser:2
        infravermelho:2 micro-ondas:2 som$:1.5 sonor:2 efeito_doppler:3 calorimetr:3 calor_especifico:3 conveccao:3
        isolante_termico:3 maquina_termica:3 dinamometro:3 plano_inclinado:3 roldana:3 polia:3 movimento_uniforme:3
        movimento_circular:3 lancamento:2 projetil:3 kepler:3 relatividade:3 quantic:2.5 turbina:2 fotovoltaic:2.5
        disjuntor:3 fusivel:3 curto-circuito:3 voltagem:3 freio:1.5 airbag:2.5 velocimetro:3 radar:2 fisic:1
        resistencia:1.5 sensor:1.5 temperatura:1 termometro:2.5 condutor:1.5 isolante:1.5 ohmic:3`,
      assuntos: {
        'Mecânica': 'velocidade:2 aceleracao:2 forca$ forcas$ newton:2 atrito:2 colisao:2 quantidade_de_movimento:3 energia_cinetica:3 energia_potencial:3 energia_mecanica:3 queda_livre:3 lancamento:2 trajetoria:2 inercia:2 torque:2 alavanca:2 plano_inclinado:3 roldana:2 polia:2 movimento gravidade:2 gravitac:2 orbita:2 satelite kepler:2 empuxo:3 hidrostatic:3 pressao densidade vazao mola$:2 pendulo:2 freio km/h m/s peso$ impulso',
        'Termologia': 'calor$:2 termic:2 temperatura:2 termodinamic:3 dilatac:3 calorimetr:3 calor_especifico:3 conducao conveccao:3 irradiacao:2 isolante:2 maquina_termica:3 ebulicao fusao$ gas_ideal:3',
        'Óptica': 'lente:3 espelho:3 refrac:3 reflexao:2 optic:2 luz$:2 fibra_optica:3 laser cor$ cores$ arco-iris:2 miopia:3 hipermetropia:3',
        'Ondulatória': 'onda$:2 ondas$:2 frequencia:2 comprimento_de_onda:3 som$:2 sonor:2 acustic:2 ultrassom:2 ressonancia:2 difrac:3 interferencia:2 efeito_doppler:3 hertz:2 decibel:2 micro-ondas:2 espectro infravermelho ultravioleta',
        'Eletricidade e magnetismo': 'corrente_eletrica:3 tensao:2 resistor:3 resistencia:2 circuito:3 capacitor:3 campo_magnetico:3 campo_eletrico:3 carga_eletrica:3 eletromagnet:3 volt$:2 volts$:2 watt:2 kwh:2 chuveiro:2 lampada:2 transformador:3 gerador:2 ampere:2 ohm:2 potencia_eletrica:3 eletric magnetic:2 ima$:2 bobina:2 disjuntor:2 fusivel:2 curto-circuito:2 voltagem:2 bateria pilha',
        'Física moderna': 'fissao:3 fusao_nuclear:3 efeito_fotoeletrico:3 foton:3 relatividade:3 quantic:3 radiacao:2 radioativ:2 raios_x:2 nuclear:2 meia-vida:2',
      },
    },
    {
      id: 'quimica', nome: 'Química', areas: ['natureza', 'natureza-matematica'], geral: 'Outros',
      termos: `reacao:2 reacoes:2 molecul:2 atomo:2 atomic:1.5 ion$:2 ions$:2 ionic:2 ph$:2.5 acido:2 acida:1.5 acidez:2 alcalin:2
        oxidac:2.5 oxidante:2.5 redutor:2.5 mol$:2.5 mols$:2.5 mol/l:3 g/mol:3 concentrac:1.5 solubilidade:3 solvente:3 soluto:3
        solucao_aquosa:3 covalente:3 apolar:3 polaridade:3 hidrocarboneto:3 alcool$:1.5 alcoois:2.5 etanol:2 metanol:3 ester$:2.5
        esteres:3 aldeido:3 cetona:3 amina$:2.5 polimero:3 combustao:2 catalisador:3 catalis:2.5 equilibrio_quimico:3 entalpia:3
        exotermic:3 endotermic:3 eletrolise:3 pilha:2 corrosao:2 tabela_periodica:3 elemento_quimico:3 elementos_quimicos:3
        isotopo:2 radioativ:1.5 meia-vida:2 estequiometr:3 massa_molar:3 titulac:3 destilac:3 filtrac:2 decantac:3 mistura$:1.5
        misturas$:1.5 substancia:1.5 composto$:1.5 compostos$:1.5 formula_molecular:3 formula_estrutural:3 hidrogenio:1.5
        enxofre:2 cloro$:2 cloreto:2.5 sodio:1.5 sulfato:3 nitrato:2.5 carbonato:3 hidroxido:3 oxido:2.5 quimic:2 ppm$:2
        detergente:2 sabao:2 tensoativo:3 biodiesel:2 chuva_acida:3 ozonio:1.5 nox$:3 anion:3 cation:3 ligacao_quimica:3
        ligacoes_quimicas:3 ligacoes_de_hidrogenio:3 funcao_organica:3 funcoes_organicas:3 cadeia_carbonica:3 isomer:3
        saponificac:3 esterificac:3 neutralizac:3 precipitado:3 reagente:2.5 velocidade_da_reacao:3 energia_de_ativacao:3
        calor_de_combustao:3 poder_calorifico:2.5 octanagem:3 gasolina:1.5 metais_pesados:2.5 mercurio:1.5 chumbo:1.5
        aluminio:1.5 cobre$:1.5 zinco:2 ferrugem:2.5 galvaniz:3 eletroquimic:3 anodo:3 catodo:3 potencial_de_reducao:3
        monoxido:2 amonia:2.5 acido_sulfurico:3 acido_cloridrico:3 soda_caustica:3 vinagre:2 bicarbonato:2.5 volatil:2
        ebulicao:2 ponto_de_fusao:2.5 craqueamento:3 plastico:1.5 pesticida:1.5 farmaco:1.5 principio_ativo:2`,
      assuntos: {
        'Química orgânica': 'hidrocarboneto:3 alcool$:2 alcoois:2 etanol:2 metanol:2 ester$:3 esteres:3 aldeido:3 cetona:3 amina$:3 polimero:3 funcao_organica:3 funcoes_organicas:3 cadeia_carbonica:3 isomer:3 saponificac:3 esterificac:3 organic:2 petroleo plastico:2 biodiesel:2 formula_estrutural:2 gasolina craqueamento:3',
        'Físico-química': 'concentrac:2 solubilidade:3 solvente:2 soluto:2 mol/l:3 entalpia:3 exotermic:3 endotermic:3 eletrolise:3 pilha:2 corrosao:2 catalis:2 equilibrio_quimico:3 ph$:2 velocidade_da_reacao:3 energia_de_ativacao:3 eletroquimic:3 anodo:3 catodo:3 calor_de_combustao:3 poder_calorifico:3 titulac:3 neutralizac:2 diluic:3 osmose:2 pressao_de_vapor:3 ebulicao',
        'Química geral e inorgânica': 'atomo:2 atomic:2 tabela_periodica:3 elemento_quimico:3 elementos_quimicos:3 isotopo:2 ligacao:2 ligacoes:2 covalente:3 ionic:2 polaridade:3 apolar:2 acido base$ oxido:2 hidroxido:2 cloreto:2 sulfato:2 nitrato:2 carbonato:2 metal$ metais$ ion$ ions$ anion:2 cation:2 nox$:3 oxidac:2',
        'Estequiometria': 'estequiometr:3 massa_molar:3 g/mol:3 mol$:2 mols$:2 rendimento:2 pureza:3 reagente:2 excesso:2 quantidade_de_materia:3',
        'Separação de misturas': 'destilac:3 filtrac:3 decantac:3 mistura$:2 misturas$:2 centrifug:3 cromatografia:3 flotac:3 separac:2',
        'Química ambiental': 'chuva_acida:3 ozonio:2 efeito_estufa:3 poluic:2 poluente:2 metais_pesados:3 agrotoxico:2 tratamento_de_agua:3 esgoto:2 reciclagem:2 lixo:2 residuo:2 gas_carbonico co2$ aquecimento:2',
      },
    },
    {
      id: 'biologia', nome: 'Biologia', areas: ['natureza', 'natureza-matematica'], geral: 'Outros',
      termos: `celul:2 dna$:3 rna$:3 gene$:2.5 genes$:2.5 genetic:2.5 genom:3 cromossom:3 proteina:1.5 enzima:2 bacteria:2 virus$:2
        viral:2 fungo:2 especie$:2 especies$:2 ecossistema:3 cadeia_alimentar:3 teia_alimentar:3 fotossintese:3 organismo:2
        selecao_natural:3 mutac:2 hormoni:2 hormonio:2 sangue:1.5 sanguine:1.5 vacina:2 anticorpo:3 imunolog:3 sistema_imun:3
        reproduc:1.5 embri:2 mitocondri:3 ribossom:3 parasit:2 hospedeiro:3 predador:2 predac:2.5 biodiversidade:2 doenca:1.5
        infecc:2 sistema_nervoso:3 digest:1.5 respiracao_celular:3 microrganismo:2 biotecnolog:3 transgenic:3 clonagem:3
        heredit:3 alelo:3 fenotip:3 genotip:3 nicho:2 simbios:3 mutualis:3 decompositor:3 inseto:1.5 mamifero:2 anfibio:2
        reptil:2 peixe:1 polinizac:3 clorofila:3 neuronio:3 insulina:3 glicemia:2 diabetes:2 tumor:2 cancer$:1.5 antibiotico:3
        nivel_trofico:3 niveis_troficos:3 especiac:3 filogen:3 taxonom:3 evolutiv:2.5 darwin:3 lamarck:3 adaptac:1.5
        ancestral:2 biolog:2 planta$:1 plantas$:1 vegetal:1.5 vegetais:1.5 animal$:1 animais$:1 semente:1.5 fruto:1.5
        germinac:2.5 xilema:3 floema:3 estomato:3 membrana:2 nucleo_celular:3 citoplasma:3 mitose:3 meiose:3 gameta:3
        fecundac:2.5 zigoto:3 celulas-tronco:3 celulas_tronco:3 sintese_proteica:3 aminoacido:2 nucleotideo:3 codon:3 crispr:3
        teste_de_paternidade:3 tipo_sanguineo:3 sistema_abo:3 daltonis:3 hemofilia:3 dengue:2.5 malaria:3 aids$:2.5 hiv$:2.5
        covid:2 tuberculose:2.5 verminose:3 esquistossomose:3 doenca_de_chagas:3 leishmaniose:3 febre_amarela:3 zika:2.5
        mosquito:2 aedes:3 eutrofizac:3 bioacumulac:3 magnificacao_trofica:3 especie_exotica:3 especies_invasoras:3 extinc:2
        habitat:2.5 ciclo_do_nitrogenio:3 fixacao_de_nitrogenio:3 sucessao_ecologica:3 ecolog:2 metabolis:2 atp$:3 glicose:1.5
        colesterol:2 rim$:2 rins$:2 figado:2 pulmao:1.5 arteria:2 digestorio:3 excrec:2.5 sinapse:3 contracao_muscular:2.5
        leucocito:3 hemacia:3 linfocito:3 plaqueta:3 anemia:2.5 alergi:2 inflamac:2 placenta:3 anticoncepcional:3 ovulac:3
        testosterona:3 estrogeno:3 tireoide:3 pancreas:3`,
      assuntos: {
        'Ecologia': 'ecossistema:3 cadeia_alimentar:3 teia_alimentar:3 nivel_trofico:3 niveis_troficos:3 nicho:2 simbios:3 mutualis:3 decompositor:3 predador:2 predac:2 biodiversidade:2 bioma:2 habitat:2 eutrofizac:3 bioacumulac:3 magnificacao:3 especie_exotica:3 especies_invasoras:3 extinc:2 biomassa ciclo_do:2 sucessao_ecologica:3 ecolog:2 desmatamento:2 poluic competic:2',
        'Genética e biotecnologia': 'dna$:3 rna$:3 gene$:3 genes$:3 genetic:3 genom:3 cromossom:3 heredit:3 alelo:3 fenotip:3 genotip:3 transgenic:3 clonagem:3 biotecnolog:3 crispr:3 teste_de_paternidade:3 tipo_sanguineo:3 sistema_abo:3 daltonis:3 hemofilia:3 mutac:2 sintese_proteica:3 codon:3 nucleotideo:3 celulas-tronco:3 celulas_tronco:3',
        'Evolução': 'selecao_natural:3 evoluc:2 evolutiv:3 darwin:3 lamarck:3 adaptac:2 ancestral:2 especiac:3 filogen:3 fossil:2',
        'Citologia e bioquímica': 'celul:2 membrana:2 mitocondri:3 ribossom:3 citoplasma:3 mitose:3 meiose:3 enzima:2 proteina aminoacido:2 atp$:3 respiracao_celular:3 fermentac:2 fotossintese:3 clorofila:3 glicose lipidio carboidrato metabolis:2 osmose:2',
        'Fisiologia humana': 'hormoni:2 hormonio:2 sangue:2 sistema_nervoso:3 neuronio:3 insulina:3 glicemia:3 diabetes:2 digest:2 rim$:2 rins$:2 figado:2 pulmao:2 coracao:2 arteria:2 excrec:2 sinapse:3 musculo leucocito:2 hemacia:2 linfocito:2 anemia:2 placenta:2 anticoncepcional:3 ovulac:3 testosterona:3 estrogeno:3 tireoide:3 pancreas:3 colesterol:2',
        'Saúde, doenças e microbiologia': 'doenca:2 infecc:2 virus$:2 viral:2 bacteria:2 fungo:2 parasit:2 hospedeiro:2 vacina:3 anticorpo:3 imunolog:3 sistema_imun:3 antibiotico:3 dengue:3 malaria:3 aids$:3 hiv$:3 covid:3 tuberculose:3 verminose:3 esquistossomose:3 chagas:3 leishmaniose:3 febre_amarela:3 zika:3 mosquito:2 aedes:3 epidemia:2 pandemia:2 saneamento:2 microrganismo:2',
        'Botânica': 'planta$:2 plantas$:2 vegetal:2 vegetais:2 semente:2 fruto:2 germinac:3 xilema:3 floema:3 estomato:3 transpiracao:2 polinizac:3 flor$:2 flores$:2 raiz$ folha$ caule:2',
        'Zoologia': 'animal$ animais$ inseto:2 mamifero:2 anfibio:3 reptil:3 peixe:2 ave$:2 aves$:2 invertebrado:3 vertebrado:3 artropode:3 molusco:3',
      },
    },
    {
      id: 'matematica', nome: 'Matemática', areas: ['matematica', 'natureza-matematica'], geral: 'Outros',
      termos: `funcao$:2.5 funcoes$:2.5 equacao$:1.5 equacoes$:1.5 triangulo:3 retangulo:2 circunferencia:3 circulo:1.5 perimetro:3
        probabilidade:3 porcentagem:1.5 juros:3 progressao:3 matriz$:3 matrizes$:3 determinante:3 polinomi:3 logaritm:3 seno$:3
        cosseno:3 tangente:2.5 trigonometr:3 geometr:2 cilindro:2 cone$:2 esfera:1.5 prisma:2.5 piramide:2 poliedro:3
        combinatoria:3 permutac:3 media_aritmetica:3 mediana:3 desvio_padrao:3 inequac:3 parabola:3 vertice:2 reta$:2 retas$:2
        plano_cartesiano:3 coordenadas:1.5 fracao:2 divisor:2 multiplo:2 numero_primo:3 numeros_primos:3 hipotenusa:3 cateto:3
        diagonal:2 angulo:2 algarismo:2.5 numeros_reais:3 numeros_inteiros:3 numeros_naturais:3 conjunto$:1.5 raizes$:1.5
        expressao_algebrica:3 termo_geral:3 valor_de_x:3 lados$:1.5 poligono:3 hexagono:3 trapezio:3 losango:3 paralelogramo:3
        quantas_maneiras:3 sistema_linear:3 numero_complexo:3 numeros_complexos:3 binomio:3 exponencial:2 lucro:1.5 desconto:2`,
      assuntos: {
        'Porcentagem, razão e proporção': 'porcent:2 %:1 por_cento:2 razao$:2 proporc:2 regra_de_tres:3 escala$:2 juros:3 desconto:2 acrescimo:2 taxa$ lucro preco:0.5 velocidade_media:2 rendimento:0.5',
        'Estatística': 'media$:2 media_aritmetica:3 mediana:3 moda$:2 desvio:3 variancia:3 amostra:2 histograma:3 quartil:3 frequencia',
        'Probabilidade': 'probabilidade:3 sorteio:2 sortead:2 aleatori:2 chance:2 moeda$ urna:3 dado$',
        'Análise combinatória': 'combinac:2 permutac:3 arranjo:2 senha:2 quantas_maneiras:3 maneiras_distintas:3 modos_distintos:3 formas_distintas:3 principio_multiplicativo:3 anagrama:3 de_quantas:2 possibilidades:2',
        'Geometria plana': 'triangulo:2 retangulo:2 quadrado$ circulo:2 circunferencia:2 area$ perimetro:3 poligono:3 angulo:2 trapezio:3 losango:3 hexagono:3 diagonal:2 hipotenusa:3 cateto:3 pitagoras:3 semelhanca:2 raio$ diametro:2 setor_circular:3',
        'Geometria espacial': 'volume:2 cilindro:3 cone$:3 esfera:3 prisma:3 piramide:3 cubo$:3 paralelepipedo:3 poliedro:3 capacidade:2 litro aresta:3 faces$:2 solido:2 planificac:3 reservatorio:2',
        'Funções': 'funcao$:2 funcoes$:2 parabola:3 exponencial:3 logaritm:3 afim$:3 quadratica:3 lei_de_formacao:3 crescente:2 decrescente:2 maximo minimo vertice:2 dominio$:2',
        'Equações e álgebra': 'equacao:2 equacoes:2 inequac:3 sistema_de_equac:3 sistema_linear:3 polinomi:3 raizes$:2 incognita:3 expressao_algebrica:3 fatorac:3 valor_de_x:3 matriz:3 determinante:3',
        'Aritmética e números': 'divisor:3 multiplo:3 mmc$:3 mdc$:3 primo$:2 primos$:2 fracao:2 fracoes:2 decimal:2 notacao_cientifica:3 potencia_de:2 algarismo:3 numeracao:2 resto_da_divisao:3 arredond:2 ordem_de_grandeza:3 unidade_de_medida:2 conversao:2',
        'Trigonometria': 'seno$:3 cosseno:3 tangente:3 trigonometr:3 sen$:2 cos$:2 radiano:3',
        'Geometria analítica': 'plano_cartesiano:3 coordenada:2 reta$:2 distancia_entre:2 ponto_medio:3 coeficiente_angular:3 eixo abscissa:3 ordenada:3',
        'Sequências': 'progressao:3 sequencia:2 termo_geral:3 padrao$ regularidade:2',
        'Gráficos e tabelas': 'grafico:1.5 tabela:1.5 infografico:2',
      },
    },
  ];

  const PADRAO_DA_AREA = {
    linguagens: 'portugues', humanas: 'historia', natureza: 'biologia', matematica: 'matematica', 'natureza-matematica': 'matematica',
  };

  function compilar(lista) {
    return String(lista || '').split(/\s+/).filter(Boolean).map(item => {
      const corte = item.lastIndexOf(':');
      let termo = corte > 0 ? item.slice(0, corte) : item;
      const peso = corte > 0 ? parseFloat(item.slice(corte + 1)) : 1;
      const inteiro = termo.endsWith('$');
      if (inteiro) termo = termo.slice(0, -1);
      return { agulha: ' ' + termo.replace(/_/g, ' ') + (inteiro ? ' ' : ''), peso };
    });
  }

  for (const d of DISCIPLINAS) {
    d.lista = compilar(d.termos);
    d.listasDeAssunto = Object.entries(d.assuntos).map(([nome, termos]) => ({ nome, lista: compilar(termos) }));
  }
  const POR_ID = Object.fromEntries(DISCIPLINAS.map(d => [d.id, d]));

  function normalizar(texto) {
    return ' ' + String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9%/-]+/g, ' ') + ' ';
  }

  // Soma dos pesos dos termos presentes; cada termo conta no máximo 3 vezes.
  function pontuar(texto, lista) {
    let total = 0;
    for (const { agulha, peso } of lista) {
      let vezes = 0;
      let pos = texto.indexOf(agulha);
      while (pos !== -1 && vezes < 3) {
        vezes++;
        pos = texto.indexOf(agulha, pos + Math.max(1, agulha.length - 1)); // o espaço final pode abrir a próxima ocorrência
      }
      total += vezes * peso;
    }
    return total;
  }

  // questao: { idioma?, contexto?, comando?, alternativas?, texto? }; area: campo da prova.
  function classificar(questao, area) {
    if (questao.idioma && POR_ID[questao.idioma]) {
      return { disciplina: questao.idioma, assunto: POR_ID[questao.idioma].geral };
    }
    const texto = normalizar([
      questao.contexto, questao.comando, (questao.alternativas || []).map(a => a.texto).join(' '), questao.texto,
    ].join(' '));

    let escolhida = POR_ID[PADRAO_DA_AREA[area]] || null;
    let melhor = 1.4; // abaixo disso não há sinal suficiente e vale a disciplina mais comum da área
    for (const d of DISCIPLINAS) {
      if (area && !d.areas.includes(area)) continue; // sem área, concorrem todas as disciplinas
      const pontos = pontuar(texto, d.lista);
      if (pontos > melhor) { melhor = pontos; escolhida = d; }
    }
    if (!escolhida) return { disciplina: null, assunto: null };

    let assunto = escolhida.geral;
    let melhorAssunto = 0.9;
    for (const a of escolhida.listasDeAssunto) {
      const pontos = pontuar(texto, a.lista);
      if (pontos > melhorAssunto) { melhorAssunto = pontos; assunto = a.nome; }
    }
    return { disciplina: escolhida.id, assunto };
  }

  BQ.classificador = {
    classificar,
    nome: id => (POR_ID[id] ? POR_ID[id].nome : id),
    disciplinas: area => DISCIPLINAS.filter(d => d.areas.includes(area)).map(d => ({ id: d.id, nome: d.nome })),
  };
})();
