// ============================================================
// METAL DRAGON - Edição Pixel Art HD + Combate & Controle PC
// Autor: Arthur ("Thurzin") - Turma 8C
// ============================================================

const canvas = document.getElementById("tela-jogo");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Resolução interna baixa (480x220) ampliada 2x no canvas (960x440)
// Isso cria pixels verdadeiros e super nítidos!
const LARGURA_BASE = 480;
const ALTURA_BASE = 220;
const ESCALA_PIXEL = 2;

// Elementos da interface
const vidasTexto = document.getElementById("vidas-texto");
const faseTexto = document.getElementById("fase-texto");
const comboTexto = document.getElementById("combo-texto");
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
const btnEsq = document.getElementById("btn-esq");
const btnDir = document.getElementById("btn-dir");
const btnPular = document.getElementById("btn-pular");
const btnDash = document.getElementById("btn-dash");
const btnAtacar = document.getElementById("btn-atacar");

const prefereMenosAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Constantes do jogo
const TOTAL_FASES = 6;
const PONTOS_MAXIMOS = 2500;
const CHAO_Y = 184;
const GRAVIDADE = 0.34;
const FORCA_PULO = -6.8;

// Estado principal
let estadoJogo = "inicio";
let faseAtual = 1;
let vidas = 3;
let pontos = 0;
let combo = 0;
let errosRitmoSeguidos = 0;
let tempoInicioPartida = 0;
let frameContador = 0;
let tremorTela = 0;
let timerFeedback = null;

// Medidor de ritmo (0 a 100)
let posicaoRitmo = 0;
let direcaoRitmo = 1;
let velocidadeRitmo = 1.3;

// Controles de teclado/toque ativos
const teclas = {
  esquerda: false,
  direita: false
};

// Dragão Roqueiro (coordenadas em pixels reais da grade 480x220)
const dragao = {
  x: 22,
  y: CHAO_Y - 26,
  largura: 22,
  altura: 26,
  vx: 0,
  vy: 0,
  direcao: 1, // 1 = direita, -1 = esquerda
  noChao: true,
  invulneravel: 0,
  dashTempo: 0,
  dashRecarga: 0,
  atacandoTempo: 0
};

// Entidades da fase
let plataformas = [];
let guerreiros = [];
let projeteisDragao = [];
let projeteisInimigos = [];
let particulas = [];
let bauTesouro = { x: 430, y: CHAO_Y - 20, largura: 22, altura: 20 };

// ============================================================
// ÁUDIO CHIPTUNE / METAL SINTETIZADO OFFLINE
// ============================================================
let audioCtx = null;

function tocarSom(freq, tipo, duracao, vol = 0.1) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracao);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duracao);
  } catch (e) {}
}

function somPulo() { tocarSom(290, "square", 0.11); }
function somDash() { tocarSom(420, "sawtooth", 0.12, 0.12); }
function somFogo() {
  tocarSom(120, "sawtooth", 0.15, 0.15);
  setTimeout(() => tocarSom(240, "square", 0.18, 0.12), 50);
}
function somHitInimigo() { tocarSom(90, "square", 0.14, 0.16); }
function somErro() { tocarSom(75, "triangle", 0.25, 0.18); }
function somVitoria() {
  tocarSom(330, "square", 0.1);
  setTimeout(() => tocarSom(440, "square", 0.1), 100);
  setTimeout(() => tocarSom(660, "square", 0.22), 200);
}

// ============================================================
// FEEDBACK E HUD
// ============================================================
function mostrarFeedback(texto, tipo) {
  feedbackBanner.textContent = texto;
  feedbackBanner.className = "feedback-banner " + (tipo === "acerto" ? "feedback-acerto" : "feedback-erro");
  if (timerFeedback) clearTimeout(timerFeedback);
  timerFeedback = setTimeout(() => feedbackBanner.classList.add("oculto"), 2200);
}

function atualizarPainel() {
  vidasTexto.textContent = vidas > 0 ? "❤️".repeat(vidas) : "💀";
  faseTexto.textContent = `${faseAtual} / ${TOTAL_FASES}`;
  comboTexto.textContent = `${combo}x`;
  pontosTexto.textContent = pontos;
  errosRitmoTexto.textContent = `Erros seguidos: ${errosRitmoSeguidos}/3`;
}

function criarParticulas(x, y, cor, quantidade = 10) {
  if (prefereMenosAnimacao) return;
  for (let i = 0; i < quantidade; i++) {
    particulas.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3.5,
      vy: (Math.random() - 0.8) * 3.2,
      vida: 18 + Math.floor(Math.random() * 12),
      cor,
      tamanho: Math.random() > 0.5 ? 2 : 1
    });
  }
}

// ============================================================
// 6 FASES ELABORADAS (PLATAFORMAS MÓVEIS + INIMIGOS VARIADOS)
// ============================================================
function carregarFase(num) {
  dragao.x = 16;
  dragao.y = CHAO_Y - dragao.altura;
  dragao.vx = 0;
  dragao.vy = 0;
  dragao.direcao = 1;
  dragao.noChao = true;
  dragao.invulneravel = 40;
  dragao.dashTempo = 0;

  projeteisDragao = [];
  projeteisInimigos = [];
  particulas = [];

  velocidadeRitmo = 1.25 + num * 0.18;
  const larguraZona = Math.max(18, 28 - num * 1.4);
  zonaAlvo.style.left = (50 - larguraZona / 2) + "%";
  zonaAlvo.style.width = larguraZona + "%";

  // Tipos de guerreiros:
  // "soldado" (patrulha), "escudeiro" (2 de vida, bloqueia de frente se não for combo), "arqueiro" (atira flechas)
  const mapas = {
    1: {
      plataformas: [
        { x: 0, y: CHAO_Y, w: 145, h: 36 },
        { x: 175, y: CHAO_Y - 14, w: 125, h: 50 },
        { x: 330, y: CHAO_Y, w: 150, h: 36 }
      ],
      guerreiros: [
        { tipo: "soldado", x: 230, y: CHAO_Y - 38, minX: 180, maxX: 280, vida: 1, maxVida: 1 },
        { tipo: "soldado", x: 375, y: CHAO_Y - 24, minX: 335, maxX: 410, vida: 1, maxVida: 1 }
      ]
    },
    2: {
      plataformas: [
        { x: 0, y: CHAO_Y, w: 115, h: 36 },
        { x: 145, y: CHAO_Y - 18, w: 75, h: 12, movelX: 35, vel: 0.7 },
        { x: 285, y: CHAO_Y - 28, w: 195, h: 64 }
      ],
      guerreiros: [
        { tipo: "soldado", x: 320, y: CHAO_Y - 52, minX: 290, maxX: 380, vida: 1, maxVida: 1 },
        { tipo: "arqueiro", x: 405, y: CHAO_Y - 52, minX: 390, maxX: 420, vida: 1, maxVida: 1 }
      ]
    },
    3: {
      plataformas: [
        { x: 0, y: CHAO_Y, w: 110, h: 36 },
        { x: 140, y: CHAO_Y - 22, w: 130, h: 58 },
        { x: 305, y: CHAO_Y - 10, w: 175, h: 46 }
      ],
      guerreiros: [
        { tipo: "escudeiro", x: 205, y: CHAO_Y - 46, minX: 150, maxX: 250, vida: 2, maxVida: 2 },
        { tipo: "arqueiro", x: 385, y: CHAO_Y - 34, minX: 350, maxX: 415, vida: 1, maxVida: 1 }
      ]
    },
    4: {
      plataformas: [
        { x: 0, y: CHAO_Y, w: 95, h: 36 },
        { x: 125, y: CHAO_Y - 25, w: 65, h: 12, movelY: 22, vel: 0.6 },
        { x: 220, y: CHAO_Y - 34, w: 110, h: 70 },
        { x: 360, y: CHAO_Y - 12, w: 120, h: 48 }
      ],
      guerreiros: [
        { tipo: "soldado", x: 265, y: CHAO_Y - 58, minX: 225, maxX: 315, vida: 1, maxVida: 1 },
        { tipo: "escudeiro", x: 395, y: CHAO_Y - 36, minX: 365, maxX: 425, vida: 2, maxVida: 2 }
      ]
    },
    5: {
      plataformas: [
        { x: 0, y: CHAO_Y, w: 90, h: 36 },
        { x: 120, y: CHAO_Y - 16, w: 115, h: 52 },
        { x: 265, y: CHAO_Y - 32, w: 65, h: 12, movelX: 30, vel: 0.9 },
        { x: 380, y: CHAO_Y - 20, w: 100, h: 56 }
      ],
      guerreiros: [
        { tipo: "escudeiro", x: 165, y: CHAO_Y - 40, minX: 125, maxX: 215, vida: 2, maxVida: 2 },
        { tipo: "arqueiro", x: 405, y: CHAO_Y - 44, minX: 385, maxX: 425, vida: 2, maxVida: 2 }
      ]
    },
    6: {
      plataformas: [
        { x: 0, y: CHAO_Y, w: 85, h: 36 },
        { x: 115, y: CHAO_Y - 20, w: 110, h: 56 },
        { x: 255, y: CHAO_Y - 36, w: 105, h: 72 },
        { x: 385, y: CHAO_Y - 16, w: 95, h: 52 }
      ],
      guerreiros: [
        { tipo: "escudeiro", x: 160, y: CHAO_Y - 44, minX: 120, maxX: 205, vida: 2, maxVida: 2 },
        { tipo: "arqueiro", x: 300, y: CHAO_Y - 60, minX: 265, maxX: 340, vida: 2, maxVida: 2 },
        { tipo: "escudeiro", x: 405, y: CHAO_Y - 40, minX: 388, maxX: 425, vida: 3, maxVida: 3 }
      ]
    }
  };

  const dado = mapas[num];
  plataformas = dado.plataformas.map(p => ({
    ...p,
    baseX: p.x,
    baseY: p.y,
    dir: 1
  }));

  guerreiros = dado.guerreiros.map(g => ({
    ...g,
    w: 20,
    h: 24,
    dir: -1,
    vivo: true,
    recargaTiro: 70 + Math.floor(Math.random() * 40),
    piscarDano: 0
  }));

  const ultima = plataformas[plataformas.length - 1];
  bauTesouro = {
    x: ultima.x + ultima.w - 28,
    y: ultima.y - 20,
    largura: 22,
    altura: 20
  };

  atualizarPainel();
}

// ============================================================
// AÇÕES DE COMBATE E MOVIMENTO
// ============================================================
function acionarPulo() {
  if (estadoJogo !== "jogando") return;
  if (dragao.noChao) {
    dragao.vy = FORCA_PULO;
    dragao.noChao = false;
    somPulo();
    criarParticulas(dragao.x + 10, dragao.y + 26, "#a855f7", 6);
  }
}

function acionarDash() {
  if (estadoJogo !== "jogando") return;
  if (dragao.dashRecarga <= 0 && dragao.dashTempo <= 0) {
    dragao.dashTempo = 12;
    dragao.dashRecarga = 42;
    dragao.invulneravel = Math.max(dragao.invulneravel, 15);
    somDash();
    criarParticulas(dragao.x + 10, dragao.y + 14, "#38bdf8", 12);
  }
}

function acionarAtaqueRitmo() {
  if (estadoJogo !== "jogando") return;

  const larguraZona = Math.max(18, 28 - faseAtual * 1.4);
  const inicioZona = 50 - larguraZona / 2;
  const fimZona = 50 + larguraZona / 2;

  if (posicaoRitmo >= inicioZona && posicaoRitmo <= fimZona) {
    errosRitmoSeguidos = 0;
    combo++;
    dragao.atacandoTempo = 14;
    somFogo();

    // Ataque crítico se acertar bem no centro da zona verde!
    const critico = Math.abs(posicaoRitmo - 50) <= 5 || combo >= 3;
    const dano = critico ? 2 : 1;

    projeteisDragao.push({
      x: dragao.direcao === 1 ? dragao.x + dragao.largura : dragao.x - 14,
      y: dragao.y + 8,
      w: critico ? 18 : 12,
      h: critico ? 10 : 7,
      vx: dragao.direcao * (critico ? 5.6 : 4.5),
      dano,
      critico
    });

    pontos += critico ? 80 : 40;
    criarParticulas(dragao.x + 14, dragao.y + 12, critico ? "#facc15" : "#f97316", 8);
    mostrarFeedback(
      critico ? `🔥 SOLO CRÍTICO (${combo}x)! Rajada dupla de fogo!` : `🎸 No ritmo! (${combo}x Combo)`,
      "acerto"
    );
  } else {
    combo = 0;
    errosRitmoSeguidos++;
    somErro();
    if (errosRitmoSeguidos >= 3) {
      errosRitmoSeguidos = 0;
      perderVida("🎸 Errou o ritmo 3 vezes seguidas! Perdeu 1 coração.");
    } else {
      mostrarFeedback(`⚠️ Fora da batida! (${errosRitmoSeguidos}/3 erros seguidos)`, "erro");
    }
  }
  atualizarPainel();
}

function perderVida(motivo) {
  vidas--;
  combo = 0;
  tremorTela = prefereMenosAnimacao ? 0 : 10;
  somErro();
  atualizarPainel();

  if (vidas <= 0) {
    finalizarJogo(false, motivo + " Seus corações acabaram!");
  } else {
    mostrarFeedback(motivo, "erro");
    carregarFase(faseAtual);
  }
}

function iniciarJogo() {
  faseAtual = 1;
  vidas = 3;
  pontos = 0;
  combo = 0;
  errosRitmoSeguidos = 0;
  tempoInicioPartida = Date.now();
  estadoJogo = "jogando";

  telaInicio.classList.add("oculto");
  telaFim.classList.add("oculto");
  feedbackBanner.classList.add("oculto");

  carregarFase(faseAtual);
  notificarAlturaPortal();
}

function finalizarJogo(venceu, texto) {
  estadoJogo = "fim";
  const tempoTotalMs = Date.now() - tempoInicioPartida;

  if (venceu) {
    pontos += vidas * 150;
    somVitoria();
    tituloFim.textContent = "🏆 TESOURO RECUPERADO! 🤘";
  } else {
    tituloFim.textContent = "💀 FIM DO SHOW!";
  }

  mensagemFim.textContent = texto;
  resumoPontos.textContent = `Pontuação final: ${pontos} / ${PONTOS_MAXIMOS} pts`;
  telaFim.classList.remove("oculto");
  atualizarPainel();

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
// FÍSICA E ATUALIZAÇÃO
// ============================================================
function colide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function atualizar() {
  frameContador++;
  if (tremorTela > 0) tremorTela--;
  if (estadoJogo !== "jogando") return;

  // Atualiza barra de ritmo
  const fatorRitmo = prefereMenosAnimacao ? 0.75 : 1;
  posicaoRitmo += direcaoRitmo * velocidadeRitmo * fatorRitmo;
  if (posicaoRitmo >= 97) { posicaoRitmo = 97; direcaoRitmo = -1; }
  if (posicaoRitmo <= 0) { posicaoRitmo = 0; direcaoRitmo = 1; }
  marcadorRitmo.style.left = posicaoRitmo + "%";

  // Atualiza plataformas móveis
  for (const p of plataformas) {
    p.deltaX = 0;
    p.deltaY = 0;
    if (p.movelX) {
      const antX = p.x;
      p.x += p.dir * p.vel;
      if (p.x > p.baseX + p.movelX || p.x < p.baseX - p.movelX) p.dir *= -1;
      p.deltaX = p.x - antX;
    }
    if (p.movelY) {
      const antY = p.y;
      p.y += p.dir * p.vel;
      if (p.y > p.baseY + p.movelY || p.y < p.baseY - p.movelY) p.dir *= -1;
      p.deltaY = p.y - antY;
    }
  }

  // Contadores do dragão
  if (dragao.invulneravel > 0) dragao.invulneravel--;
  if (dragao.dashRecarga > 0) dragao.dashRecarga--;
  if (dragao.atacandoTempo > 0) dragao.atacandoTempo--;

  // Movimento horizontal no PC / Celular
  if (dragao.dashTempo > 0) {
    dragao.dashTempo--;
    dragao.vx = dragao.direcao * 5.2;
    dragao.vy = 0;
  } else {
    if (teclas.esquerda) {
      dragao.vx = -2.3;
      dragao.direcao = -1;
    } else if (teclas.direita) {
      dragao.vx = 2.3;
      dragao.direcao = 1;
    } else {
      dragao.vx = 0;
    }
    dragao.vy += GRAVIDADE;
  }

  dragao.x += dragao.vx;
  dragao.y += dragao.vy;

  // Limites laterais da tela
  if (dragao.x < 0) dragao.x = 0;
  if (dragao.x + dragao.largura > LARGURA_BASE) dragao.x = LARGURA_BASE - dragao.largura;

  dragao.noChao = false;

  // Colisão com plataformas
  for (const p of plataformas) {
    const pesAntes = dragao.y + dragao.altura - dragao.vy;
    if (
      dragao.x + dragao.largura - 4 > p.x &&
      dragao.x + 4 < p.x + p.w &&
      pesAntes <= p.y + 6 &&
      dragao.y + dragao.altura >= p.y
    ) {
      dragao.y = p.y - dragao.altura;
      dragao.vy = 0;
      dragao.noChao = true;
      dragao.x += p.deltaX || 0;
    }
  }

  // Caiu na lava
  if (dragao.y > ALTURA_BASE - 16) {
    perderVida("🌋 Caiu na lava! Pule para a próxima plataforma.");
    return;
  }

  // Atualiza projéteis de fogo do dragão
  for (let i = projeteisDragao.length - 1; i >= 0; i--) {
    const f = projeteisDragao[i];
    f.x += f.vx;
    let atingiu = false;

    for (const g of guerreiros) {
      if (!g.vivo) continue;
      if (colide(f, g)) {
        atingiu = true;
        g.vida -= f.dano;
        g.piscarDano = 8;
        somHitInimigo();
        criarParticulas(g.x + 10, g.y + 12, "#f97316", 12);

        if (g.vida <= 0) {
          g.vivo = false;
          pontos += 120;
          tremorTela = prefereMenosAnimacao ? 0 : 5;
          mostrarFeedback("⚔️ Guerreiro derrotado! +120 pts", "acerto");
        } else {
          mostrarFeedback("🛡️ Armadura rachada! Acerte mais um fogo no ritmo!", "acerto");
        }
        atualizarPainel();
        break;
      }
    }

    if (atingiu || f.x < -20 || f.x > LARGURA_BASE + 20) {
      projeteisDragao.splice(i, 1);
    }
  }

  // Atualiza guerreiros (patrulha e disparos de arqueiros)
  const caixaDragao = { x: dragao.x + 3, y: dragao.y + 3, w: dragao.largura - 6, h: dragao.altura - 4 };

  for (const g of guerreiros) {
    if (!g.vivo) continue;
    if (g.piscarDano > 0) g.piscarDano--;

    // Patrulha na plataforma
    g.x += g.dir * (g.tipo === "escudeiro" ? 0.45 : 0.75);
    if (g.x <= g.minX) { g.x = g.minX; g.dir = 1; }
    if (g.x >= g.maxX) { g.x = g.maxX; g.dir = -1; }

    // Arqueiro dispara flechas de energia
    if (g.tipo === "arqueiro") {
      g.recargaTiro--;
      if (g.recargaTiro <= 0) {
        g.recargaTiro = 115;
        const dirTiro = dragao.x < g.x ? -1 : 1;
        projeteisInimigos.push({
          x: g.x + (dirTiro === 1 ? g.w : -8),
          y: g.y + 10,
          w: 8,
          h: 3,
          vx: dirTiro * 2.4
        });
      }
    }

    // Colisão corpo a corpo com o dragão (ignora se estiver usando Dash!)
    if (dragao.invulneravel <= 0 && dragao.dashTempo <= 0 && colide(caixaDragao, g)) {
      perderVida("🛡️ Encostou no guerreiro! Use o fogo no ritmo ou o Dash (Shift) para escapar.");
      return;
    }
  }

  // Atualiza flechas dos arqueiros
  for (let i = projeteisInimigos.length - 1; i >= 0; i--) {
    const fl = projeteisInimigos[i];
    fl.x += fl.vx;

    if (dragao.invulneravel <= 0 && dragao.dashTempo <= 0 && colide(caixaDragao, fl)) {
      projeteisInimigos.splice(i, 1);
      perderVida("🏹 Atingido por flecha! Pule ou use Dash (Shift) para atravessar.");
      return;
    }

    if (fl.x < -10 || fl.x > LARGURA_BASE + 10) {
      projeteisInimigos.splice(i, 1);
    }
  }

  // Atualiza partículas pixeladas
  for (let i = particulas.length - 1; i >= 0; i--) {
    const pt = particulas[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.12;
    pt.vida--;
    if (pt.vida <= 0) particulas.splice(i, 1);
  }

  // Verifica chegada ao baú do tesouro
  const caixaBau = { x: bauTesouro.x, y: bauTesouro.y, w: bauTesouro.largura, h: bauTesouro.altura };
  if (colide(caixaDragao, caixaBau)) {
    pontos += 150;
    if (faseAtual < TOTAL_FASES) {
      somVitoria();
      faseAtual++;
      mostrarFeedback(`🎸 Fase ${faseAtual - 1} vencida! Avançando para a Fase ${faseAtual}!`, "acerto");
      carregarFase(faseAtual);
    } else {
      finalizarJogo(
        true,
        "Você derrotou todos os guerreiros da fortaleza vulcânica e recuperou o tesouro do MetalDragon!"
      );
    }
  }
}

// ============================================================
// RENDERIZAÇÃO PIXEL ART VERDADEIRA (GRADE 480x220 AMPLIADA 2X)
// ============================================================
function px(x, y, w, h, cor) {
  ctx.fillStyle = cor;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function desenharCenario() {
  // Céu noturno roxo-metal com degradê em faixas pixel art
  px(0, 0, LARGURA_BASE, 70, "#12061f");
  px(0, 70, LARGURA_BASE, 65, "#1d0b30");
  px(0, 135, LARGURA_BASE, 85, "#2b1042");

  // Lua punk gigante no fundo
  px(370, 22, 34, 34, "#ec4899");
  px(373, 25, 28, 28, "#f472b6");
  px(382, 30, 6, 6, "#db2777");
  px(390, 42, 5, 5, "#db2777");

  // Montanhas vulcânicas e torres pixeladas
  const picos = [
    [0, 184, 70, 75, 145, 184],
    [120, 184, 210, 58, 305, 184],
    [275, 184, 360, 72, 460, 184]
  ];
  ctx.fillStyle = "#190929";
  for (const [x1, y1, x2, y2, x3, y3] of picos) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.fill();
  }

  // Caixas de som gigantes (amplificadores de show)
  desenharAmplificador(54, 136);
  desenharAmplificador(315, 136);

  // Rio de lava animada na base
  const onda = Math.floor(frameContador / 10) % 2;
  px(0, ALTURA_BASE - 16, LARGURA_BASE, 16, "#b91c1c");
  px(0, ALTURA_BASE - 16, LARGURA_BASE, 4, "#f97316");
  for (let lx = onda * 12; lx < LARGURA_BASE; lx += 24) {
    px(lx, ALTURA_BASE - 15, 10, 2, "#facc15");
  }
}

function desenharAmplificador(x, y) {
  px(x, y, 24, 48, "#09090b");
  px(x + 1, y + 1, 22, 46, "#18181b");
  px(x, y, 24, 2, "#a855f7");
  // Alto-falantes
  px(x + 5, y + 7, 14, 14, "#3f3f46");
  px(x + 8, y + 10, 8, 8, "#09090b");
  px(x + 5, y + 26, 14, 14, "#3f3f46");
  px(x + 8, y + 29, 8, 8, "#09090b");
}

function desenharPlataformas() {
  for (const p of plataformas) {
    // Base de pedra escura
    px(p.x, p.y, p.w, p.h, "#27272a");
    // Borda superior neon punk
    px(p.x, p.y, p.w, 3, "#ec4899");
    px(p.x, p.y + 3, p.w, 2, "#831843");

    // Tijolos detalhados em pixel art
    for (let tx = p.x + 4; tx < p.x + p.w - 10; tx += 14) {
      px(tx, p.y + 8, 10, 5, "#3f3f46");
      if (p.h > 20) {
        px(tx + 4, p.y + 16, 10, 5, "#18181b");
      }
    }
  }
}

function desenharDragao() {
  if (dragao.invulneravel > 0 && Math.floor(dragao.invulneravel / 3) % 2 === 0) return;

  ctx.save();
  const cx = Math.round(dragao.x + dragao.largura / 2);
  const cy = Math.round(dragao.y);
  ctx.translate(cx, cy);
  ctx.scale(dragao.direcao, 1);

  // Rastro azul durante o Dash
  if (dragao.dashTempo > 0) {
    px(-18, 4, 12, 18, "rgba(56, 189, 248, 0.5)");
  }

  // Cauda com ponta elétrica
  px(-15, 15, 6, 4, "#16a34a");
  px(-18, 12, 4, 4, "#facc15");

  // Pernas animadas ao andar
  const passo = dragao.vx !== 0 && dragao.noChao ? (Math.floor(frameContador / 5) % 2 === 0 ? -1 : 1) : 0;
  px(-6, 21 + passo, 4, 5, "#15803d");
  px(2, 21 - passo, 4, 5, "#15803d");

  // Corpo verde + Jaqueta punk preta com tachinhas
  px(-8, 9, 15, 13, "#22c55e");
  px(-7, 10, 12, 9, "#09090b");
  px(-5, 11, 2, 2, "#f8fafc");
  px(1, 11, 2, 2, "#f8fafc");

  // Cabeça e focinho
  px(-2, 1, 13, 9, "#22c55e");
  px(8, 4, 5, 6, "#4ade80");

  // Moicano punk rosa
  px(-4, -3, 3, 4, "#ec4899");
  px(0, -4, 3, 5, "#ec4899");
  px(4, -2, 3, 4, "#ec4899");

  // Óculos escuros rockstar
  px(3, 3, 8, 3, "#000000");
  px(5, 4, 3, 1, "#f97316");

  // Guitarra Flying V vermelha
  px(-1, 14, 10, 4, "#ef4444");
  px(8, 13, 8, 2, "#f8fafc");

  ctx.restore();
}

function desenharGuerreiros() {
  for (const g of guerreiros) {
    if (!g.vivo) continue;
    const x = Math.round(g.x);
    const y = Math.round(g.y);

    // Barra de vida acima do guerreiro (se tiver mais de 1 de vida)
    if (g.maxVida > 1) {
      px(x + 2, y - 6, 16, 3, "#09090b");
      px(x + 2, y - 6, Math.round((g.vida / g.maxVida) * 16), 3, "#ef4444");
    }

    const corArmadura = g.piscarDano > 0 ? "#ffffff" : (g.tipo === "escudeiro" ? "#64748b" : "#94a3b8");

    // Corpo e armadura
    px(x + 4, y + 8, 12, 12, corArmadura);
    // Capacete
    px(x + 5, y + 1, 10, 7, "#cbd5e1");
    px(x + 6, y + 4, 8, 2, "#0f172a");

    // Detalhe por classe de inimigo
    if (g.tipo === "escudeiro") {
      // Escudo pesado frontal e pluma azul
      px(x + 8, y - 2, 4, 3, "#38bdf8");
      px(x + (g.dir === -1 ? 1 : 14), y + 7, 5, 13, "#1e293b");
      px(x + (g.dir === -1 ? 2 : 15), y + 8, 3, 11, "#38bdf8");
    } else if (g.tipo === "arqueiro") {
      // Capuz verde-escuro e arco
      px(x + 5, y, 10, 3, "#15803d");
      px(x + (g.dir === -1 ? 2 : 16), y + 6, 2, 12, "#d97706");
    } else {
      // Soldado com pluma vermelha e espada
      px(x + 8, y - 2, 4, 3, "#dc2626");
      px(x + (g.dir === -1 ? 2 : 16), y + 3, 2, 11, "#f8fafc");
    }

    // Botas
    px(x + 5, y + 20, 4, 4, "#334155");
    px(x + 11, y + 20, 4, 4, "#334155");
  }
}

function desenharProjeteisEParticulas() {
  // Bolas de fogo do dragão
  for (const f of projeteisDragao) {
    px(f.x, f.y, f.w, f.h, f.critico ? "#ec4899" : "#f97316");
    px(f.x + 2, f.y + 2, f.w - 4, f.h - 4, "#facc15");
  }

  // Flechas dos arqueiros
  for (const fl of projeteisInimigos) {
    px(fl.x, fl.y, fl.w, fl.h, "#f8fafc");
    px(fl.vx < 0 ? fl.x : fl.x + fl.w - 2, fl.y - 1, 2, 5, "#ef4444");
  }

  // Partículas pixeladas
  for (const pt of particulas) {
    px(pt.x, pt.y, pt.tamanho, pt.tamanho, pt.cor);
  }
}

function desenharBau() {
  const x = Math.round(bauTesouro.x);
  const y = Math.round(bauTesouro.y);

  // Brilho dourado pulsante
  if (Math.floor(frameContador / 15) % 2 === 0) {
    px(x + 9, y - 5, 2, 2, "#facc15");
    px(x + 16, y - 3, 2, 2, "#facc15");
  }

  px(x, y + 5, 22, 15, "#78350f");
  px(x + 1, y, 20, 6, "#b45309");
  px(x, y + 5, 22, 2, "#facc15");
  px(x + 9, y + 4, 4, 5, "#facc15");
}

function desenhar() {
  ctx.save();
  ctx.scale(ESCALA_PIXEL, ESCALA_PIXEL);

  if (tremorTela > 0) {
    const dx = (Math.random() - 0.5) * 3;
    const dy = (Math.random() - 0.5) * 3;
    ctx.translate(dx, dy);
  }

  desenharCenario();
  desenharPlataformas();
  desenharBau();
  desenharGuerreiros();
  desenharDragao();
  desenharProjeteisEParticulas();

  ctx.restore();
}

function loopPrincipal() {
  atualizar();
  desenhar();
  requestAnimationFrame(loopPrincipal);
}

// ============================================================
// CONTROLES DE TECLADO NO PC E BOTÕES NA TELA
// ============================================================
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "KeyA"].includes(e.code)) {
    e.preventDefault();
    teclas.esquerda = true;
  }
  if (["ArrowRight", "KeyD"].includes(e.code)) {
    e.preventDefault();
    teclas.direita = true;
  }
  if (["ArrowUp", "Space", "KeyW"].includes(e.code)) {
    e.preventDefault();
    acionarPulo();
  }
  if (["ShiftLeft", "ShiftRight", "KeyK"].includes(e.code)) {
    e.preventDefault();
    acionarDash();
  }
  if (["Enter", "KeyF", "KeyJ"].includes(e.code)) {
    e.preventDefault();
    acionarAtaqueRitmo();
  }
});

window.addEventListener("keyup", (e) => {
  if (["ArrowLeft", "KeyA"].includes(e.code)) teclas.esquerda = false;
  if (["ArrowRight", "KeyD"].includes(e.code)) teclas.direita = false;
});

// Botões direcionais na tela (suportam segurar o dedo ou mouse)
function vincularBotaoSegurar(botao, direcao) {
  const ativar = (e) => { e.preventDefault(); teclas[direcao] = true; };
  const desativar = (e) => { e.preventDefault(); teclas[direcao] = false; };
  botao.addEventListener("mousedown", ativar);
  botao.addEventListener("mouseup", desativar);
  botao.addEventListener("mouseleave", desativar);
  botao.addEventListener("touchstart", ativar, { passive: false });
  botao.addEventListener("touchend", desativar, { passive: false });
}

vincularBotaoSegurar(btnEsq, "esquerda");
vincularBotaoSegurar(btnDir, "direita");

btnPular.addEventListener("click", acionarPulo);
btnDash.addEventListener("click", acionarDash);
btnAtacar.addEventListener("click", acionarAtaqueRitmo);
botaoComecar.addEventListener("click", iniciarJogo);
botaoReiniciar.addEventListener("click", iniciarJogo);

botaoTema.addEventListener("click", () => {
  document.body.classList.toggle("tema-claro");
  notificarAlturaPortal();
});

// Contrato do Portal (vrgame)
function notificarAlturaPortal() {
  window.parent.postMessage({ type: "vrgame:resize", height: document.documentElement.scrollHeight }, "*");
}

window.addEventListener("message", (e) => {
  const dados = e.data;
  if (!dados || typeof dados !== "object") return;
  if (dados.type === "vrgame:theme") {
    document.body.classList.toggle("tema-claro", dados.theme === "light");
    notificarAlturaPortal();
  }
  if (dados.type === "vrgame:fullscreen") {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }
});

window.addEventListener("resize", notificarAlturaPortal);
window.addEventListener("load", () => {
  desenhar();
  window.parent.postMessage({ type: "vrgame:ready" }, "*");
  notificarAlturaPortal();
});

requestAnimationFrame(loopPrincipal);