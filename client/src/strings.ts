// Every piece of text the player sees. Informal Brazilian Portuguese.
import type { ErrorCode, Theme } from "@lorota/shared";

export const S = {
  appName: "LOROTA",
  tagline: "Invente uma resposta que pareça verdade, engane os amigos e descubra o que é real.",

  // Connection
  connecting: "Conectando…",
  reconnecting: "Conexão perdida. Reconectando…",
  detached: "Você abriu essa sala em outra aba.",

  // Início / Salas
  nicknameLabel: "Seu apelido",
  nicknamePlaceholder: "Como te chamam?",
  createRoom: "Criar sala",
  roomCodeLabel: "Código da sala",
  roomCodePlaceholder: "ABCD",
  join: "Entrar",
  openRooms: "Salas abertas",
  noRooms: "Nenhuma sala por aqui. Crie a primeira!",
  roomOf: (host: string) => `Sala de ${host}`,
  playerCount: (n: number, max: number) => `${n}/${max}`,
  inLobby: "No lobby",
  playing: "Jogando",
  chooseNickname: "Escolha um apelido",
  enterRoomCode: "Digite o código da sala",

  // Lobby
  roomCode: "Código da sala",
  copyInvite: "Copiar link de convite",
  linkCopied: "Link copiado!",
  players: "Jogadores",
  hostTag: "dono da sala",
  youTag: "você",
  disconnected: "desconectado",
  startGame: "Começar jogo",
  needMorePlayers: "Precisa de pelo menos 2 jogadores pra começar",
  waitingHost: "Esperando o dono da sala começar",
  leaveRoom: "Sair da sala",
  theme: "Tema",

  themes: {
    geral: "Geral",
    historia: "História",
    esportes: "Esportes",
    influenciadores: "Influenciadores",
    musica: "Música",
    filmes: "Filmes",
  } satisfies Record<Theme, string>,

  // Escrita
  roundOf: (n: number, total: number) => `Rodada ${n} de ${total}`,
  lieLabel: "Sua lorota",
  liePlaceholder: "Escreva sua lorota",
  send: "Enviar",
  youSent: "Você mandou:",
  blankAnswer: "(em branco)",
  waitingOthers: "Esperando os outros jogadores",
  secondsLeft: (s: number) => `${s}s`,

  // Votação
  whatsTheTruth: "Qual é a verdade?",
  youPicked: "Voto registrado!",

  // Revelação
  writtenBy: (nick: string) => `escrita por ${nick}`,
  theTruth: "A VERDADE",
  whoFell: (nicks: string) => `Quem caiu: ${nicks}`,
  nobodyFell: "Ninguém caiu nessa",
  whoGotIt: (nicks: string) => `Quem acertou: ${nicks}`,
  nobodyGotIt: "Ninguém acertou",
  ownPick: (nick: string) => `${nick} (na própria)`,
  pointsTo: (points: number, nick: string) => `+${points} para ${nick}`,
  pointsEach: (points: number) => `+${points} para cada`,
  noPoints: "Nenhum ponto",

  // Placar / Fim de jogo
  scoreboard: "Placar",
  roundGain: (n: number) => `+${n}`,
  points: (n: number) => `${n} pts`,
  position: (n: number) => `${n}º`,
  gameOver: "Fim de jogo",
  winnerIs: (nicks: string) => `${nicks} venceu!`,
  winnersAre: (nicks: string) => `${nicks} empataram no topo!`,
  playAgain: "Jogar de novo",
  waitingPlayAgain: "Esperando o dono da sala decidir se vai ter revanche",
  and: " e ",

  // Chat
  chat: "Chat",
  chatLabel: "Mensagem",
  chatPlaceholder: "Manda uma mensagem",
  chatEmpty: "Nenhuma mensagem ainda. Manda um oi!",
  chatTime: (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),

  // Audio
  music: "Música",
  effects: "Efeitos",

  errors: {
    ROOM_FULL: "Sala cheia",
    ROOM_NOT_FOUND: "Sala não encontrada",
    GAME_STARTED: "O jogo já começou",
    NICKNAME_TAKEN: "Esse apelido já está em uso",
    INVALID_NICKNAME: "Escolha um apelido",
    NOT_IN_ROOM: "Você não está nessa sala",
    NOT_HOST: "Só o dono da sala pode fazer isso",
    NOT_ENOUGH_PLAYERS: "Precisa de pelo menos 2 jogadores",
    WRONG_PHASE: "Não dá pra fazer isso agora",
    ALREADY_SUBMITTED: "Você já mandou sua resposta",
    ALREADY_VOTED: "Você já votou",
    INVALID_OPTION: "Opção inválida",
    INVALID_PAYLOAD: "Algo deu errado. Tenta de novo",
  } satisfies Record<ErrorCode, string>,
  genericError: "Algo deu errado. Tenta de novo",
};

export function errorText(code: string | undefined): string {
  return (code && (S.errors as Record<string, string>)[code]) || S.genericError;
}

/** "Ana", "Ana e Bia", "Ana, Bia e Caio" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")}${S.and}${names.at(-1)}`;
}
