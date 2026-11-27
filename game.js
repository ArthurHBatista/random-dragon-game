// ============================================================
// METAL DRAGON - Jogo de Plataforma + Ritmo Rock/Metal
// Autor: Arthur ("Thurzin") - Turma 8C
// ============================================================

const canvas = document.getElementById("tela-jogo");
const ctx = canvas.getContext("2d");

// Elementos da interface
const vidasTexto = document.getElementById("vidas-texto");
const faseTexto = document.getElementById("fase-texto");
const pontosTexto = document.getElementById("pontos-texto");
const errosRitmoTexto = document.getElementById("erros-ritmo-texto");
const feedbackBanner = document.getElementById("feedback-banner");
const telaInicio = document.getElementById("tela-inicio");
const telaFim = document.getElementById("tela-fim");
const tituloFim = document.getElementById("titulo-fim");
const mensagemFim = document.getElementById("mensagem-fim");
const resumoPontos = document.getElementById("resumo-pontos");
const marcadorRitmo = document.getElementById("marcador-ritmo");
const zonaAlvo = document.getElementById("zona-alvo");

// Botões
const botaoComecar = document.getElementById("botao-comecar");
const botaoReiniciar = document.getElementById("botao-reiniciar");
const botaoTema = document.getElementById("botao-tema");
const btnPular = document.getElementById("btn-pular");
const btnAtacar = document.getElementById("btn-atacar");

// Preferência de redução de movimento do navegador
const prefereMenosAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Configurações gerais do jogo
const TOTAL_FASES = 6;
const PONTOS_MAXIMOS = 1200;
const CHAO_Y = 290;
const GRAVIDADE = 0.65;
const FORCA_PULO = -13.5;

// Estado principal do jogo
let estadoJogo = "inicio"; // "inicio", "jogando", "fim"
let faseAtual = 1;
let vidas = 3;
let pontos = 0;
let errosRitmoSeguidos = 0;
let tempoInicioPartida = 0;
let ultimoQuadro = 0;
let timerFeedback = null;

// Variáveis do medidor de ritmo (0 a 100)
let posicaoRitmo = 0;
let direcaoRitmo = 1;
let velocidadeRitmo = 1.25;

// Objeto do Dragão Roqueiro
const dragao = {
  x: 70,
  y: CHAO_Y - 48,
  largura: 44,
  altura: 48,
  velocidadeY: 0,
  velocidadeX: 3.1,
  noChao: true,
  invulneravelTempo: 0,
  atacandoTempo: 0
};

// Elementos da fase atual
let plataformas = [];
let guerreiros = [];
let bolasDeFogo = [];
let bauTesouro = { x: 720, y: CHAO_Y - 40, largura: 42, altura: 40 };
let raiosFundo = [];

// ============================================================
// SISTEMA DE SOM ROCK/8-BIT OFFLINE (Web Audio API)
// ============================================================
let audioCtx = null;

function tocarSom(frequencia, tipo, duracao, volume = 0.12) {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    const oscilador = audioCtx.createOscillator();
    const ganho = audioCtx.createGain();
    oscilador.type = tipo;
    oscilador.frequency.setValueAtTime(frequencia, audioCtx.currentTime);
    ganho.gain.setValueAtTime(volume, audioCtx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracao);

    oscilador.connect(ganho);
    ganho.connect(audioCtx.destination);
    oscilador.start();
    oscilador.stop(audioCtx.currentTime + duracao);
  } catch (e) {
    // Ignora caso o navegador bloqueie áudio antes de interação
  }
}

function somPulo() {
  tocarSom(260, "square", 0.14);
}

function somFogoAcerto() {
  tocarSom(110, "sawtooth", 0.18, 0.18);
  setTimeout(() => tocarSom(220, "sawtooth", 0.22, 0.15), 60);
}

function somErro() {
  tocarSom(95, "triangle", 0.28, 0.2);
}

function somVitoriaFase() {
  tocarSom(330, "square", 0.12);
  setTimeout(() => tocarSom(440, "square", 0.12), 110);
  setTimeout(() => tocarSom(660, "square", 0.25), 220);
}

// ============================================================
// MENSAGENS RÁPIDAS DE EXPLICAÇÃO (FEEDBACK)
// ============================================================
function mostrarFeedback(texto, tipo) {
  feedbackBanner.textContent = texto;
  feedbackBanner.className = "feedback-banner " + (tipo === "acerto" ? "feedback-acerto" : "feedback-erro");

  if (timerFeedback) clearTimeout(timerFeedback);
  timerFeedback = setTimeout(() => {
    feedbackBanner.classList.add("oculto");
  }, 2400);
}

function atualizarPainel() {
  vidasTexto.textContent = vidas > 0 ? "❤️".repeat(vidas) : "💀";
  faseTexto.textContent = `${faseAtual} / ${TOTAL_FASES}`;
  pontosTexto.textContent = pontos;
  errosRitmoTexto.textContent = `Erros seguidos: ${errosRitmoSeguidos}/3`;
}

// ============================================================
// MONTAGEM DAS 6 FASES (DIFICULDADE CRESCENTE)
// ============================================================
function carregarFase(numeroFase) {
  // Reinicia posição do dragão no início da fase
  dragao.x = 35;
  dragao.y = CHAO_Y - dragao.altura;
  dragao.velocidadeY = 0;
  dragao.noChao = true;
  dragao.invulneravelTempo = 45;
  bolasDeFogo = [];

  // Aumenta velocidade do ritmo e do dragão aos poucos
  velocidadeRitmo = 1.15 + numeroFase * 0.22;
  dragao.velocidadeX = 2.7 + numeroFase * 0.25;

  // Define tamanho da zona verde de ritmo (vai ficando um pouco mais precisa)
  const larguraZona = Math.max(16, 26 - numeroFase * 1.4);
  const inicioZona = 50 - larguraZona / 2;
  zonaAlvo.style.left = inicioZona + "%";
  zonaAlvo.style.width = larguraZona + "%";

  // Layouts das 6 fases (plataformas sólidas sobre rio de lava)
  const mapas = {
    1: {
      plataformas: [
        { x: 0, y: CHAO_Y, largura: 310, altura: 70 },
        { x: 375, y: CHAO_Y, largura: 425, altura: 70 }
      ],
      guerreiros: [
        { x: 490, y: CHAO_Y - 46, largura: 38, altura: 46, vivo: true }
      ]
    },
    2: {
      plataformas: [
        { x: 0, y: CHAO_Y, largura: 240, altura: 70 },
        { x: 310, y: CHAO_Y - 20, largura: 200, altura: 90 },
        { x: 575, y: CHAO_Y, largura: 225, altura: 70 }
      ],
      guerreiros: [
        { x: 420, y: CHAO_Y - 66, largura: 38, altura: 46, vivo: true },
        { x: 640, y: CHAO_Y - 46, largura: 38, altura: 46, vivo: true }
      ]
    },
    3: {
      plataformas: [
        { x: 0, y: CHAO_Y, largura: 200, altura: 70 },
        { x: 270, y: CHAO_Y - 25, largura: 180, altura: 95 },
        { x: 520, y: CHAO_Y, largura: 280, altura: 70 }
      ],
      guerreiros: [
        { x: 375, y: CHAO_Y - 71, largura: 38, altura: 46, vivo: true },
        { x: 615, y: CHAO_Y - 46, largura: 38, altura: 46, vivo: true }
      ]
    },
    4: {
      plataformas: [
        { x: 0, y: CHAO_Y, largura: 180, altura: 70 },
        { x: 255, y: CHAO_Y, largura: 165, altura: 70 },
        { x: 495, y: CHAO_Y - 25, largura: 305, altura: 95 }
      ],
      guerreiros: [
        { x: 345, y: CHAO_Y - 46, largura: 38, altura: 46, vivo: true },
        { x: 565, y: CHAO_Y - 71, largura: 38, altura: 46, vivo: true },
        { x: 650, y: CHAO_Y - 71, largura: 38, altura: 46, vivo: true }
      ]
    },
    5: {
      plataformas: [
        { x: 0, y: CHAO_Y, largura: 170, altura: 70 },
        { x: 245, y: CHAO_Y - 30, largura: 155, altura: 100 },
        { x: 470, y: CHAO_Y - 10, largura: 140, altura: 80 },
        { x: 665, y: CHAO_Y, largura: 135, altura: 70 }
      ],
      guerreiros: [
        { x: 330, y: CHAO_Y - 76, largura: 38, altura: 46, vivo: true },
        { x: 545, y: CHAO_Y - 56, largura: 38, altura: 46, vivo: true }
      ]
    },
    6: {
      plataformas: [
        { x: 0, y: CHAO_Y, largura: 165, altura: 70 },
        { x: 240, y: CHAO_Y - 20, largura: 170, altura: 90 },
        { x: 485, y: CHAO_Y - 35, largura: 315, altura: 105 }
      ],
      guerreiros: [
        { x: 335, y: CHAO_Y - 66, largura: 38, altura: 46, vivo: true },
        { x: 545, y: CHAO_Y - 81, largura: 38, altura: 46, vivo: true },
        { x: 635, y: CHAO_Y - 81, largura: 38, altura: 46, vivo: true }
      ]
    }
  };

  const dadosFase = mapas[numeroFase];
  plataformas = dadosFase.plataformas.map(p => ({ ...p }));
  guerreiros = dadosFase.guerreiros.map(g => ({ ...g }));

  // Posiciona o baú de tesouro no final da última plataforma
  const ultimaPlat = plataformas[plataformas.length - 1];
  bauTesouro = {
    x: ultimaPlat.x + ultimaPlat.largura - 56,
    y: ultimaPlat.y - 40,
    largura: 42,
    altura: 40
  };

  atualizarPainel();
}

// ============================================================
// AÇÕES DO JOGADOR (PULAR E ATACAR NO RITMO)
// ============================================================
function acionarPulo() {
  if (estadoJogo !== "jogando") return;
  if (dragao.noChao) {
    dragao.velocidadeY = FORCA_PULO;
    dragao.noChao = false;
    somPulo();
  }
}

function acionarAtaqueRitmo() {
  if (estadoJogo !== "jogando") return;

  const larguraZona = Math.max(16, 26 - faseAtual * 1.4);
  const inicioZona = 50 - larguraZona / 2;
  const fimZona = 50 + larguraZona / 2;

  // Verifica se o marcador está dentro da zona verde
  if (posicaoRitmo >= inicioZona && posicaoRitmo <= fimZona) {
    errosRitmoSeguidos = 0;
    dragao.atacandoTempo = 18;
    somFogoAcerto();

    // Dispara uma bola de fogo punk
    bolasDeFogo.push({
      x: dragao.x + dragao.largura,
      y: dragao.y + 14,
      largura: 24,
      altura: 16,
      velocidade: 8.5
    });

    pontos += 50;
    mostrarFeedback("🔥 RIFF PERFEITO! Rajada de fogo disparada no ritmo!", "acerto");
  } else {
    errosRitmoSeguidos++;
    somErro();

    if (errosRitmoSeguidos >= 3) {
      errosRitmoSeguidos = 0;
      perderVida("🎸 Errou o ritmo 3 vezes seguidas! Perdeu 1 coração.");
    } else {
      mostrarFeedback(`⚠️ Fora do tempo! (${errosRitmoSeguidos}/3 erros seguidos)`, "erro");
    }
  }
  atualizarPainel();
}

function perderVida(motivo) {
  vidas--;
  somErro();
  atualizarPainel();

  if (vidas <= 0) {
    finalizarJogo(false, motivo + " Seus corações acabaram!");
  } else {
    mostrarFeedback(motivo, "erro");
    // Reposiciona no início da fase atual
    carregarFase(faseAtual);
  }
}

// ============================================================
// CONTROLE DE INÍCIO E FIM DE JOGO
// ============================================================
function iniciarJogo() {
  faseAtual = 1;
  vidas = 3;
  pontos = 0;
  errosRitmoSeguidos = 0;
  tempoInicioPartida = Date.now();
  estadoJogo = "jogando";

  telaInicio.classList.add("oculto");
  telaFim.classList.add("oculto");
  feedbackBanner.classList.add("oculto");

  carregarFase(faseAtual);
  notificarAlturaPortal();
}

function finalizarJogo(venceu, textoExplicacao) {
  estadoJogo = "fim";
  const tempoTotalMs = Date.now() - tempoInicioPartida;

  // Bônus pelos corações restantes na vitória
  if (venceu) {
    pontos += vidas * 100;
    somVitoriaFase();
    tituloFim.textContent = "🏆 TESOURO RECUPERADO! 🤘";
  } else {
    tituloFim.textContent = "💀 FIM DO SHOW!";
  }

  mensagemFim.textContent = textoExplicacao;
  resumoPontos.textContent = `Pontuação final: ${pontos} / ${PONTOS_MAXIMOS} pts`;
  telaFim.classList.remove("oculto");
  atualizarPainel();

  // Envia resultado final para o portal da escola
  window.parent.postMessage(
    {
      type: "vrgame:finish",
      score: Math.min(pontos, PONTOS_MAXIMOS),
      maxScore: PONTOS_MAXIMOS,
      timeMs: tempoTotalMs,
      detail: { jogo: "metal-dragon" }
    },
    "*"
  );
  notificarAlturaPortal();
}

// ============================================================
// ATUALIZAÇÃO DA FÍSICA E COLISÕES
// ============================================================
function colidem(a, b) {
  return (
    a.x < b.x + b.largura &&
    a.x + a.largura > b.x &&
    a.y < b.y + b.altura &&
    a.y + a.altura > b.y
  );
}

function atualizar() {
  if (estadoJogo !== "jogando") return;

  // Move o marcador na barra de ritmo
  const fatorAnimacao = prefereMenosAnimacao ? 0.75 : 1;
  posicaoRitmo += direcaoRitmo * velocidadeRitmo * fatorAnimacao;
  if (posicaoRitmo >= 97) {
    posicaoRitmo = 97;
    direcaoRitmo = -1;
  } else if (posicaoRitmo <= 0) {
    posicaoRitmo = 0;
    direcaoRitmo = 1;
  }
  marcadorRitmo.style.left = posicaoRitmo + "%";

  // Contadores de animação
  if (dragao.invulneravelTempo > 0) dragao.invulneravelTempo--;
  if (dragao.atacandoTempo > 0) dragao.atacandoTempo--;

  // Movimento horizontal automático do dragão
  dragao.x += dragao.velocidadeX;

  // Gravidade e queda
  dragao.velocidadeY += GRAVIDADE;
  dragao.y += dragao.velocidadeY;
  dragao.noChao = false;

  // Verifica apoio nas plataformas de pedra
  for (const plat of plataformas) {
    const pesAntes = dragao.y + dragao.altura - dragao.velocidadeY;
    if (
      dragao.x + dragao.largura - 8 > plat.x &&
      dragao.x + 8 < plat.x + plat.largura &&
      pesAntes <= plat.y + 8 &&
      dragao.y + dragao.altura >= plat.y
    ) {
      dragao.y = plat.y - dragao.altura;
      dragao.velocidadeY = 0;
      dragao.noChao = true;
    }
  }

  // Caiu na lava
  if (dragao.y > canvas.height - 25) {
    perderVida("🌋 Caiu na lava! Pule antes do fim da plataforma.");
    return;
  }

  // Atualiza bolas de fogo
  for (let i = bolasDeFogo.length - 1; i >= 0; i--) {
    const fogo = bolasDeFogo[i];
    fogo.x += fogo.velocidade;

    // Verifica acerto nos guerreiros
    for (const guerreiro of guerreiros) {
      if (guerreiro.vivo && colidem(fogo, guerreiro)) {
        guerreiro.vivo = false;
        bolasDeFogo.splice(i, 1);
        pontos += 100;
        atualizarPainel();
        mostrarFeedback("⚔️ Guerreiro derrotado com solo de fogo! +100 pts", "acerto");
        break;
      }
    }

    if (fogo && fogo.x > canvas.width) {
      bolasDeFogo.splice(i, 1);
    }
  }

  // Verifica choque do dragão com guerreiro vivo
  for (const guerreiro of guerreiros) {
    if (guerreiro.vivo && colidem(dragao, guerreiro)) {
      perderVida("🛡️ Bateu em um guerreiro! Ataque no ritmo antes de encostar.");
      return;
    }
  }

  // Verifica se encostou no baú de tesouro no fim da fase
  if (colidem(dragao, bauTesouro)) {
    pontos += 100;
    if (faseAtual < TOTAL_FASES) {
      somVitoriaFase();
      faseAtual++;
      mostrarFeedback(`🎸 Fase ${faseAtual - 1} concluída! Prepare-se para a Fase ${faseAtual}!`, "acerto");
      carregarFase(faseAtual);
    } else {
      finalizarJogo(
        true,
        "Você derrotou os guerreiros do castelo vulcânico e recuperou o tesouro do MetalDragon!"
      );
    }
  }

  // Gera raio decorativo ocasional no céu (se animações estiverem ativas)
  if (!prefereMenosAnimacao && Math.random() < 0.015) {
    raiosFundo.push({ x: Math.random() * canvas.width, vida: 8 });
  }
  for (let i = raiosFundo.length - 1; i >= 0; i--) {
    raiosFundo[i].vida--;
    if (raiosFundo[i].vida <= 0) raiosFundo.splice(i, 1);
  }
}

// ============================================================
// DESENHO EM ESTILO PIXEL ART PUNK / METAL VULCÂNICO
// ============================================================
function desenharCenario() {
  // Céu roxo sombrio metal
  ctx.fillStyle = "#160924";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Raios punk no fundo
  ctx.strokeStyle = "#f472b6";
  ctx.lineWidth = 3;
  for (const raio of raiosFundo) {
    ctx.beginPath();
    ctx.moveTo(raio.x, 0);
    ctx.lineTo(raio.x - 18, 70);
    ctx.lineTo(raio.x + 12, 120);
    ctx.lineTo(raio.x - 10, 190);
    ctx.stroke();
  }

  // Silhueta de montanhas vulcânicas e torres medievais
  ctx.fillStyle = "#26123b";
  ctx.beginPath();
  ctx.moveTo(0, 290);
  ctx.lineTo(130, 120);
  ctx.lineTo(270, 290);
  ctx.lineTo(430, 95);
  ctx.lineTo(600, 290);
  ctx.lineTo(730, 130);
  ctx.lineTo(800, 290);
  ctx.fill();

  // Caixas de som gigantes (amplificadores Marshall estilo pixel art)
  desenharAmplificador(140, 210);
  desenharAmplificador(590, 210);

  // Rio de lava brilhante na base
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(0, canvas.height - 28, canvas.width, 28);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(0, canvas.height - 28, canvas.width, 8);
}

function desenharAmplificador(x, y) {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x, y, 44, 70);
  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, 44, 70);

  // Alto-falantes circulares
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.arc(x + 22, y + 20, 11, 0, Math.PI * 2);
  ctx.arc(x + 22, y + 50, 11, 0, Math.PI * 2);
  ctx.fill();
}

function desenharPlataformas() {
  for (const plat of plataformas) {
    // Pedra medieval escura
    ctx.fillStyle = "#3f3f46";
    ctx.fillRect(plat.x, plat.y, plat.largura, plat.altura);

    // Borda superior punk neon
    ctx.fillStyle = "#db2777";
    ctx.fillRect(plat.x, plat.y, plat.largura, 6);

    // Detalhes de tijolos em pixel art
    ctx.fillStyle = "#27272a";
    for (let tx = plat.x + 8; tx < plat.x + plat.largura - 16; tx += 28) {
      ctx.fillRect(tx, plat.y + 14, 18, 10);
      ctx.fillRect(tx + 8, plat.y + 30, 18, 10);
    }
  }
}

function desenharDragao() {
  // Efeito de piscar quando está invulnerável
  if (dragao.invulneravelTempo > 0 && Math.floor(dragao.invulneravelTempo / 4) % 2 === 0) {
    return;
  }

  const x = Math.round(dragao.x);
  const y = Math.round(dragao.y);

  // Cauda com ponta de raio
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(x - 10, y + 26, 12, 10);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(x - 14, y + 22, 6, 8);

  // Corpo do dragão
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(x + 4, y + 14, 28, 26);

  // Jaqueta punk preta com tachinhas
  ctx.fillStyle = "#09090b";
  ctx.fillRect(x + 6, y + 18, 22, 16);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(x + 9, y + 20, 3, 3);
  ctx.fillRect(x + 17, y + 20, 3, 3);

  // Cabeça e focinho
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(x + 18, y + 2, 24, 18);

  // Moicano punk rosa/vermelho
  ctx.fillStyle = "#ec4899";
  ctx.fillRect(x + 14, y - 6, 6, 10);
  ctx.fillRect(x + 21, y - 8, 6, 10);
  ctx.fillRect(x + 28, y - 5, 6, 8);

  // Óculos escuros rockstar
  ctx.fillStyle = "#000000";
  ctx.fillRect(x + 28, y + 6, 12, 5);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(x + 30, y + 7, 4, 3);

  // Guitarra elétrica estilo Flying V nas patas
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(x + 18, y + 26, 20, 8);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x + 34, y + 24, 14, 4);

  // Pernas
  ctx.fillStyle = "#15803d";
  ctx.fillRect(x + 8, y + 40, 8, 8);
  ctx.fillRect(x + 22, y + 40, 8, 8);
}

function desenharGuerreiros() {
  for (const g of guerreiros) {
    if (!g.vivo) continue;
    const x = Math.round(g.x);
    const y = Math.round(g.y);

    // Armadura metálica
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(x + 8, y + 14, 22, 24);

    // Capacete medieval com viseira
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(x + 10, y, 18, 14);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x + 10, y + 5, 12, 4);

    // Pluma vermelha no elmo
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(x + 16, y - 6, 8, 6);

    // Escudo e espada
    ctx.fillStyle = "#475569";
    ctx.fillRect(x + 2, y + 16, 8, 18);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x + 4, y + 4, 4, 16);

    // Botas
    ctx.fillStyle = "#334155";
    ctx.fillRect(x + 9, y + 38, 7, 8);
    ctx.fillRect(x + 22, y + 38, 7, 8);
  }
}

function desenharBolasDeFogo() {
  for (const f of bolasDeFogo) {
    ctx.fillStyle = "#f97316";
    ctx.fillRect(f.x, f.y, f.largura, f.altura);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(f.x + 6, f.y + 4, f.largura - 10, f.altura - 8);
  }
}

function desenharBau() {
  const x = bauTesouro.x;
  const y = bauTesouro.y;

  // Caixa de madeira reforçada
  ctx.fillStyle = "#92400e";
  ctx.fillRect(x, y + 10, bauTesouro.largura, 30);

  // Tampa arredondada
  ctx.fillStyle = "#b45309";
  ctx.fillRect(x + 2, y, bauTesouro.largura - 4, 12);

  // Detalhes em ouro e brilho
  ctx.fillStyle = "#facc15";
  ctx.fillRect(x, y + 10, bauTesouro.largura, 4);
  ctx.fillRect(x + 17, y + 8, 8, 10);
}

function desenhar() {
  desenharCenario();
  desenharPlataformas();
  desenharBau();
  desenharGuerreiros();
  desenharBolasDeFogo();
  desenharDragao();
}

// Loop principal do jogo
function loopPrincipal(timestamp) {
  if (!ultimoQuadro) ultimoQuadro = timestamp;
  ultimoQuadro = timestamp;

  atualizar();
  desenhar();
  requestAnimationFrame(loopPrincipal);
}

// ============================================================
// EVENTOS DE TECLADO, TOQUE E PORTAL DA ESCOLA
// ============================================================
window.addEventListener("keydown", (evento) => {
  if (["ArrowUp", "Space", "KeyW"].includes(evento.code)) {
    evento.preventDefault();
    acionarPulo();
  }
  if (["Enter", "KeyF", "KeyJ"].includes(evento.code)) {
    evento.preventDefault();
    acionarAtaqueRitmo();
  }
});

btnPular.addEventListener("click", acionarPulo);
btnAtacar.addEventListener("click", acionarAtaqueRitmo);
botaoComecar.addEventListener("click", iniciarJogo);
botaoReiniciar.addEventListener("click", iniciarJogo);

// Alternância manual de tema claro/escuro
botaoTema.addEventListener("click", () => {
  document.body.classList.toggle("tema-claro");
  notificarAlturaPortal();
});

// Integração obrigatória com o portal (vrgame)
function notificarAlturaPortal() {
  window.parent.postMessage(
    {
      type: "vrgame:resize",
      height: document.documentElement.scrollHeight
    },
    "*"
  );
}

window.addEventListener("message", (evento) => {
  const dados = evento.data;
  if (!dados || typeof dados !== "object") return;

  if (dados.type === "vrgame:theme") {
    if (dados.theme === "light") {
      document.body.classList.add("tema-claro");
    } else {
      document.body.classList.remove("tema-claro");
    }
    notificarAlturaPortal();
  }

  if (dados.type === "vrgame:fullscreen") {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }
});

window.addEventListener("resize", notificarAlturaPortal);

window.addEventListener("load", () => {
  desenhar();
  window.parent.postMessage({ type: "vrgame:ready" }, "*");
  notificarAlturaPortal();
});

// Inicia o ciclo visual
requestAnimationFrame(loopPrincipal);