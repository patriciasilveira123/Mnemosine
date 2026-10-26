import bustSocrates from '../assets/images/bust3d_socrates_1793038304578.jpg';
import bustBeauvoir from '../assets/images/bust3d_beauvoir_1793038305437.jpg';
import bustPlatao from '../assets/images/bust3d_platao_1793038306940.jpg';
import bustArendt from '../assets/images/bust3d_arendt_1793038310307.jpg';
import bustSchopenhauer from '../assets/images/bust3d_schopenhauer_1793038310921.jpg';
import bustHypatia from '../assets/images/bust3d_hypatia_1793038312119.jpg';
import bustAristoteles from '../assets/images/bust3d_aristoteles_1793038314551.jpg';
import bustWollstonecraft from '../assets/images/bust3d_wollstonecraft_1793038317042.jpg';
import bustDescartes from '../assets/images/bust3d_descartes_1793038319448.jpg';
import bustDjamila from '../assets/images/bust3d_djamila_1793038320093.jpg';
import bustNietzsche from '../assets/images/bust3d_nietzsche_1793038324502.jpg';
import bustEdithStein from '../assets/images/bust3d_edith_stein_1793038324274.jpg';
import bustKant from '../assets/images/bust3d_kant_1793038325982.jpg';
import bustSpinoza from '../assets/images/bust3d_spinoza_1793038327822.jpg';
import bustFoucault from '../assets/images/bust3d_foucault_1793038327953.jpg';

export interface Philosopher {
  id: string;
  name: string;
  gender: 'filósofo' | 'filósofa';
  concept: string;
  conceptTitle: string;
  conceptDescription: string;
  era: string;
  icon: string;
  image: string;
}

export const CORE_PHILOSOPHERS: Philosopher[] = [
  {
    id: 'socrates',
    name: 'SÓCRATES',
    gender: 'filósofo',
    concept: 'Maiêutica',
    conceptTitle: 'Maiêutica',
    conceptDescription: 'O parto das ideias por meio de diálogos, reflexão e questionamentos constantes.',
    era: 'Antiguidade',
    icon: 'lightbulb',
    image: bustSocrates
  },
  {
    id: 'beauvoir',
    name: 'SIMONE DE BEAUVOIR',
    gender: 'filósofa',
    concept: 'Existencialismo Feminista',
    conceptTitle: 'Existencialismo Feminista',
    conceptDescription: 'Não se nasce mulher, torna-se mulher. Liberdade e construção autônoma da existência.',
    era: 'Contemporânea',
    icon: 'auto_stories',
    image: bustBeauvoir
  },
  {
    id: 'platao',
    name: 'PLATÃO',
    gender: 'filósofo',
    concept: 'Mundo das Ideias',
    conceptTitle: 'Mundo das Ideias',
    conceptDescription: 'Distinção entre o mundo sensível ilusório e o mundo inteligível das formas puras.',
    era: 'Antiguidade',
    icon: 'spa',
    image: bustPlatao
  },
  {
    id: 'arendt',
    name: 'HANNAH ARENDT',
    gender: 'filósofa',
    concept: 'Ação Política',
    conceptTitle: 'Ação Política',
    conceptDescription: 'A pluralidade humana, o discurso e a capacidade de agir em conjunto na polis.',
    era: 'Contemporânea',
    icon: 'public',
    image: bustArendt
  },
  {
    id: 'schopenhauer',
    name: 'ARTHUR SCHOPENHAUER',
    gender: 'filósofo',
    concept: 'Vontade e Representação',
    conceptTitle: 'Vontade e Representação',
    conceptDescription: 'A essência cega e universal do mundo que impulsiona todo desejo humano.',
    era: 'Séc. XIX',
    icon: 'sentiment_dissatisfied',
    image: bustSchopenhauer
  },
  {
    id: 'hypatia',
    name: 'HIPÁTIA DE ALEXANDRIA',
    gender: 'filósofa',
    concept: 'Neoplatonismo',
    conceptTitle: 'Neoplatonismo',
    conceptDescription: 'A busca pela sabedoria e harmonia cósmica pela matemática e astronomia.',
    era: 'Antiguidade Tardia',
    icon: 'star',
    image: bustHypatia
  }
];

export const EXTENDED_PHILOSOPHERS: Philosopher[] = [
  ...CORE_PHILOSOPHERS,
  {
    id: 'aristoteles',
    name: 'ARISTÓTELES',
    gender: 'filósofo',
    concept: 'Eudaimonia',
    conceptTitle: 'Eudaimonia',
    conceptDescription: 'A felicidade como fim supremo através da moderação e do cultivo do caráter virtuoso.',
    era: 'Antiguidade',
    icon: 'balance',
    image: bustAristoteles
  },
  {
    id: 'wollstonecraft',
    name: 'MARY WOLLSTONECRAFT',
    gender: 'filósofa',
    concept: 'Direitos da Mulher',
    conceptTitle: 'Direitos da Mulher',
    conceptDescription: 'Defesa da igualdade moral, racional e educacional entre todas as pessoas.',
    era: 'Iluminismo',
    icon: 'history_edu',
    image: bustWollstonecraft
  },
  {
    id: 'descartes',
    name: 'RENÉ DESCARTES',
    gender: 'filósofo',
    concept: 'Cogito Ergo Sum',
    conceptTitle: 'Cogito Ergo Sum',
    conceptDescription: 'Penso, logo existo. A dúvida metódica como via para o fundamento indubitável da verdade.',
    era: 'Moderna',
    icon: 'psychology',
    image: bustDescartes
  },
  {
    id: 'djamila',
    name: 'DJAMILA RIBEIRO',
    gender: 'filósofa',
    concept: 'Lugar de Fala',
    conceptTitle: 'Lugar de Fala',
    conceptDescription: 'Descolonização do pensamento e visibilidade das vozes historicamente silenciadas.',
    era: 'Contemporânea',
    icon: 'record_voice_over',
    image: bustDjamila
  },
  {
    id: 'nietzsche',
    name: 'FRIEDRICH NIETZSCHE',
    gender: 'filósofo',
    concept: 'Vontade de Poder',
    conceptTitle: 'Vontade de Poder',
    conceptDescription: 'Afirmação heroica da existência e recriação de valores para além do bem e do mal.',
    era: 'Séc. XIX',
    icon: 'bolt',
    image: bustNietzsche
  },
  {
    id: 'stein',
    name: 'EDITH STEIN',
    gender: 'filósofa',
    concept: 'Empatia',
    conceptTitle: 'Empatia',
    conceptDescription: 'A compreensão viva do outro e a vivência da empatia como ponte entre consciências.',
    era: 'Séc. XX',
    icon: 'favorite',
    image: bustEdithStein
  },
  {
    id: 'kant',
    name: 'IMMANUEL KANT',
    gender: 'filósofo',
    concept: 'Imperativo Categórico',
    conceptTitle: 'Imperativo Categórico',
    conceptDescription: 'Age de tal forma que a máxima da tua ação possa tornar-se uma lei universal.',
    era: 'Iluminismo',
    icon: 'gavel',
    image: bustKant
  },
  {
    id: 'spinoza',
    name: 'BARUCH SPINOZA',
    gender: 'filósofo',
    concept: 'Deus sive Natura',
    conceptTitle: 'Deus sive Natura',
    conceptDescription: 'Deus ou a Natureza: uma única substância infinita da qual todos nós fazemos parte.',
    era: 'Moderna',
    icon: 'nature_people',
    image: bustSpinoza
  },
  {
    id: 'foucault',
    name: 'MICHEL FOUCAULT',
    gender: 'filósofo',
    concept: 'Biopolítica',
    conceptTitle: 'Biopolítica',
    conceptDescription: 'O poder disseminado em instituições, discursos e corpos na sociedade disciplinar.',
    era: 'Contemporânea',
    icon: 'visibility',
    image: bustFoucault
  }
];
