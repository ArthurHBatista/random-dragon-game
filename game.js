// ============================================================
// METAL DRAGON - Edição Pixel Art Renderizada & Fases Longas
// Inspiração visual: Escamas Ciano/Verde-Menta, Sombras Roxas/Bronze,
// Contornos Escuros e Iluminação Punk/Vulcânica
// Autor: Arthur ("Thurzin") - Turma 8C
// ============================================================

const canvas = document.getElementById("tela-jogo");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Grade interna de pixels nítidos ampliada 2x no canvas (960x440)
const LARGURA_TELA = 480;
const ALTURA_TELA = 220;
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

// Constantes físicas e de mundo
const TOTAL_FASES = 6;
const PONTOS_MAXIMOS = 3500;
const CHAO_Y = 186;
const GRAVIDADE = 0.34;
const FORCA_PULO = -6.9;

// Estado do jogo
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

// Câmera para fases longas
let cameraX = 0;
let larguraFaseAtual = 1500;

// Medidor de ritmo (0 a 100)
let posicaoRitmo = 0;
let direcaoRitmo = 1;
let velocidadeRitmo = 1.3;

// Controles ativos
const teclas = { esquerda: false, direita: false };

// Dragão Serpentino Punk (inspirado na arte de referência)
const dragao = {
  x: 24,
  y: CHAO_Y - 28,
  largura: 28,
  altura: 28,
  vx: 0,
  vy: 0,
  direcao: 1,
  noChao: true,
  invulneravel: 0,
  dashTempo: 0,
  dashRecarga: 0,
  atacandoTempo: 0
};

// Entidades da fase
let plataformas = [];
let guerreiros = [];
let cristais = [];
let projeteisDragao = [];
let projeteisInimigos = [];
let particulas = [];
let bauTesouro = { x: 1400, y: CHAO_Y - 22, largura: 24, altura: 22 };

// ============================================================
// ÁUDIO CHIPTUNE / HEAVY METAL OFFLINE
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
function somDash() { tocarSom(440, "sawtooth", 0.12, 0.12); }
function somCristal() { tocarSom(580, "sine", 0.1, 0.11); }
function somFogo() {
  tocarSom(115, "sawtooth", 0.16, 0.15);
  setTimeout(() => tocarSom(230, "square", 0.18, 0.12), 50);
}
function somHitInimigo() { tocarSom(88, "square", 0.15, 0.16); }
function somErro() { tocarSom(72, "triangle", 0.25, 0.18); }
function somVitoria() {
  tocarSom(330, "square", 0.1);
  setTimeout(() => tocarSom(440, "square", 0.1), 100);
  setTimeout(() => tocarSom(660, "square", 0.24), 200);
}

// ============================================================
// FEEDBACK E PAINEL
// ============================================================
function mostrarFeedback(texto, tipo) {
  feedbackBanner.textContent = texto;
  feedbackBanner.className = "feedback-banner " + (tipo === "acerto" ? "feedback-acerto" : "feedback-erro");
  if (timerFeedback) clearTimeout(timerFeedback);
  timerFeedback = setTimeout(() => feedbackBanner.classList.add("oculto"), 2200);
}

function atualizarPainel() {
  const progresso = Math.min(100, Math.max(0, Math.round((dragao.x / (larguraFaseAtual - 80)) * 100)));
  vidasTexto.textContent = vidas > 0 ? "❤️".repeat(vidas) : "💀";
  faseTexto.textContent = `${faseAtual} / ${TOTAL_FASES} (${progresso}%)`;
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
      vx: (Math.random() - 0.5) * 3.6,
      vy: (Math.random() - 0.85) * 3.2,
      vida: 18 + Math.floor(Math.random() * 14),
      cor,
      tamanho: Math.random() > 0.45 ? 2 : 1
    });
  }
}

// ============================================================
// GERADOR DAS 6 FASES LONGAS (1400px a 2200px DE EXTENSÃO)
// ============================================================
function carregarFase(num) {
  dragao.x = 24;
  dragao.y = CHAO_Y - dragao.altura;
  dragao.vx = 0;
  dragao.vy = 0;
  dragao.direcao = 1;
  dragao.noChao = true;
  dragao.invulneravel = 45;
  dragao.dashTempo = 0;
  cameraX = 0;

  projeteisDragao = [];
  projeteisInimigos = [];
  particulas = [];
  plataformas = [];
  guerreiros = [];
  cristais = [];

  velocidadeRitmo = 1.2 + num * 0.16;
  const larguraZona = Math.max(18, 28 - num * 1.4);
  zonaAlvo.style.left = (50 - larguraZona / 2) + "%";
  zonaAlvo.style.width = larguraZona + "%";

  // Número de trechos cresce conforme a fase (de 6 a 11 trechos longos)
  const totalTrechos = 5 + num;
  let cursorX = 0;

  // Plataforma inicial segura
  plataformas.push({ x: 0, y: CHAO_Y, w: 170, h: 36, baseX: 0, baseY: CHAO_Y, dir: 1 });
  cursorX = 170;

  for (let t = 1; t <= totalTrechos; t++) {
    const buraco = 26 + ((t + num) % 3) * 8;
    cursorX += buraco;

    const ehMovelX = (t % 3 === 0 && num >= 2);
    const ehMovelY = (t % 4 === 0 && num >= 3);
    const larguraPlat = ehMovelX || ehMovelY ? 76 : 120 + ((t * 23) % 65);
    const desnivel = ((t % 3) - 1) * 16;
    const platY = Math.min(CHAO_Y, Math.max(132, CHAO_Y + desnivel));

    const plat = {
      x: cursorX,
      y: platY,
      w: larguraPlat,
      h: ehMovelX || ehMovelY ? 14 : ALTURA_TELA - platY,
      baseX: cursorX,
      baseY: platY,
      dir: t % 2 === 0 ? 1 : -1,
      movelX: ehMovelX ? 28 : 0,
      movelY: ehMovelY ? 18 : 0,
      vel: 0.55 + num * 0.08
    };
    plataformas.push(plat);

    // Adiciona cristais de energia musical acima da plataforma
    cristais.push({
      x: plat.x + Math.round(plat.w * 0.35),
      y: plat.y - 26,
      coletado: false
    });
    if (plat.w > 130) {
      cristais.push({
        x: plat.x + Math.round(plat.w * 0.65),
        y: plat.y - 32,
        coletado: false
      });
    }

    // Adiciona inimigos nas plataformas firmes
    if (!ehMovelX && !ehMovelY && plat.w >= 115) {
      let tipo = "soldado";
      let vidaInimigo = 1;

      if (num >= 2 && t % 2 === 0) {
        tipo = "arqueiro";
        vidaInimigo = num >= 5 ? 2 : 1;
      }
      if (num >= 3 && t % 3 === 0) {
        tipo = "escudeiro";
        vidaInimigo = num >= 5 ? 3 : 2;
      }

      guerreiros.push({
        tipo,
        x: plat.x + Math.round(plat.w * 0.55),
        y: plat.y - 24,
        w: 20,
        h: 24,
        minX: plat.x + 8,
        maxX: plat.x + plat.w - 28,
        dir: -1,
        vida: vidaInimigo,
        maxVida: vidaInimigo,
        vivo: true,
        recargaTiro: 65 + (t * 15) % 45,
        piscarDano: 0
      });
    }

    cursorX += larguraPlat + (ehMovelX ? 30 : 0);
  }

  // Plataforma final da arena do baú
  cursorX += 28;
  const platFinal = {
    x: cursorX,
    y: CHAO_Y - 10,
    w: 165,
    h: 46,
    baseX: cursorX,
    baseY: CHAO_Y - 10,
    dir: 1
  };
  plataformas.push(platFinal);

  // Guardião final da fase antes do baú
  guerreiros.push({
    tipo: num >= 3 ? "escudeiro" : "soldado",
    x: platFinal.x + 55,
    y: platFinal.y - 24,
    w: 20,
    h: 24,
    minX: platFinal.x + 15,
    maxX: platFinal.x + 95,
    dir: -1,
    vida: num >= 4 ? 3 : 2,
    maxVida: num >= 4 ? 3 : 2,
    vivo: true,
    recargaTiro: 80,
    piscarDano: 0
  });

  bauTesouro = {
    x: platFinal.x + platFinal.w - 36,
    y: platFinal.y - 22,
    largura: 24,
    altura: 22
  };

  larguraFaseAtual = platFinal.x + platFinal.w + 20;
  atualizarPainel();
}

// ============================================================
// CONTROLES DE AÇÃO E COMBATE
// ============================================================
function acionarPulo() {
  if (estadoJogo !== "jogando") return;
  if (dragao.noChao) {
    dragao.vy = FORCA_PULO;
    dragao.noChao = false;
    somPulo();
    criarParticulas(dragao.x + 12, dragao.y + 28, "#4ade80", 7);
  }
}

function acionarDash() {
  if (estadoJogo !== "jogando") return;
  if (dragao.dashRecarga <= 0 && dragao.dashTempo <= 0) {
    dragao.dashTempo = 12;
    dragao.dashRecarga = 40;
    dragao.invulneravel = Math.max(dragao.invulneravel, 16);
    somDash();
    criarParticulas(dragao.x + 12, dragao.y + 14, "#2dd4bf", 12);
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
    dragao.atacandoTempo = 15;
    somFogo();

    const critico = Math.abs(posicaoRitmo - 50) <= 5 || combo >= 3;
    const dano = critico ? 2 : 1;

    projeteisDragao.push({
      x: dragao.direcao === 1 ? dragao.x + dragao.largura : dragao.x - 16,
      y: dragao.y + 8,
      w: critico ? 20 : 13,
      h: critico ? 11 : 7,
      vx: dragao.direcao * (critico ? 5.8 : 4.7),
      dano,
      critico
    });

    pontos += critico ? 80 : 40;
    criarParticulas(dragao.x + 16, dragao.y + 12, critico ? "#2dd4bf" : "#f97316", 9);
    mostrarFeedback(
      critico ? `🔥 SOLO DRACÔNICO (${combo}x)! Rajada crítica!` : `🎸 No ritmo! (${combo}x Combo)`,
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
    tituloFim.textContent = "🏆 TESOURO DO DRAGÃO CONQUISTADO! 🤘";
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
// FÍSICA, CÂMERA E COLISÕES
// ============================================================
function colide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function atualizar() {
  frameContador++;
  if (tremorTela > 0) tremorTela--;
  if (estadoJogo !== "jogando") return;

  // Medidor de ritmo
  const fatorRitmo = prefereMenosAnimacao ? 0.75 : 1;
  posicaoRitmo += direcaoRitmo * velocidadeRitmo * fatorRitmo;
  if (posicaoRitmo >= 97) { posicaoRitmo = 97; direcaoRitmo = -1; }
  if (posicaoRitmo <= 0) { posicaoRitmo = 0; direcaoRitmo = 1; }
  marcadorRitmo.style.left = posicaoRitmo + "%";

  // Plataformas móveis
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

  // Movimento horizontal
  if (dragao.dashTempo > 0) {
    dragao.dashTempo--;
    dragao.vx = dragao.direcao * 5.4;
    dragao.vy = 0;
  } else {
    if (teclas.esquerda) {
      dragao.vx = -2.4;
      dragao.direcao = -1;
    } else if (teclas.direita) {
      dragao.vx = 2.4;
      dragao.direcao = 1;
    } else {
      dragao.vx = 0;
    }
    dragao.vy += GRAVIDADE;
  }

  dragao.x += dragao.vx;
  dragao.y += dragao.vy;

  // Limites do mapa longo
  if (dragao.x < 0) dragao.x = 0;
  if (dragao.x + dragao.largura > larguraFaseAtual) dragao.x = larguraFaseAtual - dragao.largura;

  // Atualiza câmera suave acompanhando o dragão
  const alvoCam = dragao.x - LARGURA_TELA * 0.32;
  cameraX += (alvoCam - cameraX) * 0.14;
  cameraX = Math.max(0, Math.min(larguraFaseAtual - LARGURA_TELA, cameraX));

  dragao.noChao = false;

  // Colisão com plataformas
  for (const p of plataformas) {
    const pesAntes = dragao.y + dragao.altura - dragao.vy;
    if (
      dragao.x + dragao.largura - 5 > p.x &&
      dragao.x + 5 < p.x + p.w &&
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
  if (dragao.y > ALTURA_TELA - 16) {
    perderVida("🌋 Caiu na lava! Pule com firmeza entre as plataformas.");
    return;
  }

  const caixaDragao = { x: dragao.x + 4, y: dragao.y + 4, w: dragao.largura - 8, h: dragao.altura - 5 };

  // Coleta de cristais musicais
  for (const c of cristais) {
    if (!c.coletado && colide(caixaDragao, { x: c.x, y: c.y, w: 8, h: 10 })) {
      c.coletado = true;
      pontos += 25;
      somCristal();
      criarParticulas(c.x + 4, c.y + 5, "#2dd4bf", 8);
    }
  }

  // Projéteis de fogo do dragão
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
        break;
      }
    }

    if (atingiu || f.x < cameraX - 30 || f.x > cameraX + LARGURA_TELA + 30) {
      projeteisDragao.splice(i, 1);
    }
  }

  // Guerreiros (apenas os próximos da câmera agem)
  for (const g of guerreiros) {
    if (!g.vivo) continue;
    if (g.piscarDano > 0) g.piscarDano--;

    g.x += g.dir * (g.tipo === "escudeiro" ? 0.45 : 0.78);
    if (g.x <= g.minX) { g.x = g.minX; g.dir = 1; }
    if (g.x >= g.maxX) { g.x = g.maxX; g.dir = -1; }

    // Arqueiro só atira quando está visível na tela
    if (g.tipo === "arqueiro" && Math.abs(g.x - dragao.x) < 260) {
      g.recargaTiro--;
      if (g.recargaTiro <= 0) {
        g.recargaTiro = 110;
        const dirTiro = dragao.x < g.x ? -1 : 1;
        projeteisInimigos.push({
          x: g.x + (dirTiro === 1 ? g.w : -8),
          y: g.y + 10,
          w: 9,
          h: 3,
          vx: dirTiro * 2.5
        });
      }
    }

    if (dragao.invulneravel <= 0 && dragao.dashTempo <= 0 && colide(caixaDragao, g)) {
      perderVida("🛡️ Encostou no guerreiro! Use fogo no ritmo ou Dash (Shift).");
      return;
    }
  }

  // Flechas dos arqueiros
  for (let i = projeteisInimigos.length - 1; i >= 0; i--) {
    const fl = projeteisInimigos[i];
    fl.x += fl.vx;

    if (dragao.invulneravel <= 0 && dragao.dashTempo <= 0 && colide(caixaDragao, fl)) {
      projeteisInimigos.splice(i, 1);
      perderVida("🏹 Atingido por flecha! Pule ou use Dash (Shift) para atravessar.");
      return;
    }

    if (fl.x < cameraX - 40 || fl.x > cameraX + LARGURA_TELA + 40) {
      projeteisInimigos.splice(i, 1);
    }
  }

  // Partículas
  for (let i = particulas.length - 1; i >= 0; i--) {
    const pt = particulas[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.12;
    pt.vida--;
    if (pt.vida <= 0) particulas.splice(i, 1);
  }

  atualizarPainel();

  // Vitória da fase ao tocar no baú
  const caixaBau = { x: bauTesouro.x, y: bauTesouro.y, w: bauTesouro.largura, h: bauTesouro.altura };
  if (colide(caixaDragao, caixaBau)) {
    pontos += 150;
    if (faseAtual < TOTAL_FASES) {
      somVitoria();
      faseAtual++;
      mostrarFeedback(`🎸 Fase ${faseAtual - 1} concluída! Prepare-se para a Fase ${faseAtual}!`, "acerto");
      carregarFase(faseAtual);
    } else {
      finalizarJogo(
        true,
        "Você atravessou todas as 6 fases da fortaleza vulcânica e conquistou o tesouro do MetalDragon!"
      );
    }
  }
}

// ============================================================
// RENDERIZAÇÃO PIXEL ART DETALHADA (PALETA DA IMAGEM DE REFERÊNCIA)
// ============================================================
function px(x, y, w, h, cor) {
  ctx.fillStyle = cor;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function desenharCenarioParallax() {
  // Fundo céu roxo-profundo texturizado
  px(0, 0, LARGURA_TELA, 72, "#140924");
  px(0, 72, LARGURA_TELA, 66, "#210e38");
  px(0, 138, LARGURA_TELA, 82, "#30144d");

  // Lua mística ciano/roxa (paralaxe bem lenta)
  const luaX = 360 - Math.round(cameraX * 0.05);
  px(luaX, 20, 32, 32, "#5b21b6");
  px(luaX + 2, 22, 28, 28, "#2dd4bf");
  px(luaX + 4, 24, 24, 24, "#99f6e4");
  px(luaX + 18, 28, 6, 6, "#5eead4");

  // Cadeia de montanhas vulcânicas em camadas (paralaxe média)
  const offsetMontanha = Math.round(cameraX * 0.25) % 240;
  ctx.fillStyle = "#1c0b2e";
  for (let m = -240; m < LARGURA_TELA + 240; m += 240) {
    const base = m - offsetMontanha;
    ctx.beginPath();
    ctx.moveTo(base, 188);
    ctx.lineTo(base + 65, 76);
    ctx.lineTo(base + 135, 188);
    ctx.moveTo(base + 100, 188);
    ctx.lineTo(base + 175, 62);
    ctx.lineTo(base + 255, 188);
    ctx.fill();
  }

  // Pilares de pedra e amplificadores de rock no fundo (paralaxe 0.5x)
  const offsetTorres = Math.round(cameraX * 0.5) % 320;
  for (let t = -320; t < LARGURA_TELA + 320; t += 320) {
    const tx = t - offsetTorres;
    // Torre medieval roxa com brilho laranja
    px(tx + 40, 95, 34, 95, "#26113d");
    px(tx + 40, 95, 34, 4, "#fb923c");
    px(tx + 46, 110, 6, 12, "#f97316");
    px(tx + 62, 110, 6, 12, "#f97316");

    // Amplificador gigante punk
    px(tx + 185, 138, 24, 48, "#180c26");
    px(tx + 185, 138, 24, 2, "#2dd4bf");
    px(tx + 190, 144, 14, 14, "#3b1d5e");
    px(tx + 193, 147, 8, 8, "#0f0718");
    px(tx + 190, 163, 14, 14, "#3b1d5e");
    px(tx + 193, 166, 8, 8, "#0f0718");
  }
}

function desenharPlataformas() {
  for (const p of plataformas) {
    if (p.x + p.w < cameraX - 20 || p.x > cameraX + LARGURA_TELA + 20) continue;

    // Contorno escuro (estilo pixel art renderizado)
    px(p.x - 1, p.y - 1, p.w + 2, p.h + 2, "#0d0617");

    // Corpo roxo-ardósia com luz superior ciano/verde-menta e sombra bronze
    px(p.x, p.y, p.w, p.h, "#2e1a47");
    px(p.x, p.y, p.w, 3, "#34d399");
    px(p.x, p.y + 3, p.w, 2, "#0d9488");
    px(p.x, p.y + 5, p.w, 2, "#7c2d12");

    // Textura de pedras com brilho e sombra (dithering)
    for (let tx = p.x + 4; tx < p.x + p.w - 10; tx += 16) {
      px(tx, p.y + 9, 11, 5, "#432566");
      px(tx, p.y + 9, 11, 1, "#6d3fa3");
      if (p.h > 22) {
        px(tx + 5, p.y + 17, 11, 5, "#1f1033");
      }
    }
  }
}

// Dragão Serpentino com escamas verde-menta/ciano, barriga roxa/bronze e chifres dourados
function desenharDragao() {
  if (dragao.invulneravel > 0 && Math.floor(dragao.invulneravel / 3) % 2 === 0) return;

  ctx.save();
  const cx = Math.round(dragao.x + dragao.largura / 2);
  const cy = Math.round(dragao.y);
  ctx.translate(cx, cy);
  ctx.scale(dragao.direcao, 1);

  if (dragao.dashTempo > 0) {
    px(-22, 4, 14, 20, "rgba(45, 212, 191, 0.45)");
  }

  const ondaCauda = Math.floor(frameContador / 6) % 2;

  // --- CONTORNO ESCURO EXTERNO (#160b29) ---
  px(-21, 12 + ondaCauda, 11, 8, "#160b29");
  px(-12, 9, 18, 16, "#160b29");
  px(-3, 0, 16, 12, "#160b29");

  // --- CAUDA SERPENTINA COM PONTA ROXA/BRONZE ---
  px(-20, 13 + ondaCauda, 9, 5, "#5b21b6");
  px(-19, 14 + ondaCauda, 6, 2, "#fb923c");
  px(-13, 14, 5, 6, "#2dd4bf");
  px(-12, 15, 3, 3, "#bef264");

  // --- CORPO CURVO COM ESCAMAS TEXTURIZADAS (DITHERING) ---
  px(-10, 10, 15, 13, "#34d399");
  // Escamas brilhantes amarelo-lima e ciano
  px(-8, 11, 2, 2, "#bef264");
  px(-4, 12, 2, 2, "#a7f3d0");
  px(-7, 15, 2, 2, "#2dd4bf");
  px(-2, 11, 2, 2, "#bef264");

  // Barriga segmentada em roxo e bronze/laranja (igual à imagem)
  px(-9, 17, 12, 6, "#4c1d95");
  px(-8, 18, 3, 4, "#c2410c");
  px(-4, 18, 3, 4, "#ea580c");
  px(0, 18, 3, 4, "#c2410c");

  // Espinhos dorsais roxos com ponta clara
  px(-9, 8, 3, 2, "#6d28d9");
  px(-5, 7, 3, 3, "#7c3aed");
  px(-4, 7, 1, 1, "#f472b6");

  // --- GARRAS ARTICULADAS ---
  const passo = dragao.vx !== 0 && dragao.noChao ? (Math.floor(frameContador / 5) % 2 === 0 ? -1 : 1) : 0;
  px(-7, 23 + passo, 4, 4, "#34d399");
  px(-8, 26 + passo, 6, 2, "#fde047");
  px(2, 23 - passo, 4, 4, "#34d399");
  px(1, 26 - passo, 6, 2, "#fde047");

  // --- CABEÇA DETALHADA, CHIFRES RETORCIDOS E BIGODE DRACÔNICO ---
  px(-2, 1, 14, 10, "#34d399");
  px(9, 4, 6, 6, "#6ee7b7");
  // Sombras roxas na mandíbula e bochecha
  px(-2, 8, 9, 3, "#5b21b6");
  px(10, 8, 4, 2, "#4c1d95");

  // Chifres longos retorcidos em roxo com brilho dourado/laranja
  px(-4, -3, 3, 4, "#581c87");
  px(-7, -6, 4, 3, "#6b21a8");
  px(-6, -6, 2, 1, "#fde047");
  px(1, -4, 3, 5, "#581c87");
  px(2, -7, 3, 3, "#ea580c");
  px(3, -7, 2, 1, "#fef08a");

  // Olho expressivo âmbar/dourado com brilho
  px(5, 3, 4, 4, "#1e1b4b");
  px(6, 3, 3, 3, "#f97316");
  px(7, 3, 1, 1, "#fef08a");

  // Bigode oriental dourado ondulando
  px(12, 7, 3, 2, "#fde047");
  px(14, 9 + ondaCauda, 2, 3, "#facc15");

  // Guitarra elétrica Flying V nas garras
  px(0, 14, 9, 4, "#db2777");
  px(8, 13, 8, 2, "#fde047");

  ctx.restore();
}

function desenharGuerreiros() {
  for (const g of guerreiros) {
    if (!g.vivo) continue;
    if (g.x + g.w < cameraX - 20 || g.x > cameraX + LARGURA_TELA + 20) continue;

    const x = Math.round(g.x);
    const y = Math.round(g.y);

    // Barra de vida
    if (g.maxVida > 1) {
      px(x + 1, y - 7, 18, 4, "#0d0617");
      px(x + 2, y - 6, Math.round((g.vida / g.maxVida) * 16), 2, "#ef4444");
    }

    // Contorno escuro
    px(x + 3, y, 14, 24, "#0d0617");

    const corMetal = g.piscarDano > 0 ? "#ffffff" : (g.tipo === "escudeiro" ? "#7e22ce" : "#64748b");
    const corBrilho = g.tipo === "escudeiro" ? "#c084fc" : "#cbd5e1";

    // Armadura com brilho superior e sombra roxa
    px(x + 4, y + 8, 12, 12, corMetal);
    px(x + 4, y + 8, 12, 2, corBrilho);
    px(x + 5, y + 1, 10, 7, "#94a3b8");
    px(x + 6, y + 4, 8, 2, "#09050f");

    if (g.tipo === "escudeiro") {
      px(x + 8, y - 2, 4, 3, "#38bdf8");
      px(x + (g.dir === -1 ? 0 : 14), y + 6, 6, 14, "#1e1b4b");
      px(x + (g.dir === -1 ? 1 : 15), y + 7, 4, 12, "#2dd4bf");
    } else if (g.tipo === "arqueiro") {
      px(x + 5, y, 10, 3, "#15803d");
      px(x + (g.dir === -1 ? 2 : 16), y + 6, 2, 12, "#fb923c");
    } else {
      px(x + 8, y - 2, 4, 3, "#f43f5e");
      px(x + (g.dir === -1 ? 2 : 16), y + 3, 2, 11, "#f8fafc");
    }

    px(x + 5, y + 20, 4, 4, "#311042");
    px(x + 11, y + 20, 4, 4, "#311042");
  }
}

function desenharCristaisBauProjeteis() {
  // Cristais musicais flutuantes
  const flutuar = Math.floor(frameContador / 12) % 2;
  for (const c of cristais) {
    if (c.coletado) continue;
    if (c.x < cameraX - 20 || c.x > cameraX + LARGURA_TELA + 20) continue;
    px(c.x + 2, c.y + flutuar, 4, 10, "#0d9488");
    px(c.x, c.y + 2 + flutuar, 8, 6, "#2dd4bf");
    px(c.x + 2, c.y + 3 + flutuar, 3, 3, "#fef08a");
  }

  // Baú do tesouro no fim da fase longa
  px(bauTesouro.x - 1, bauTesouro.y - 1, 26, 24, "#0d0617");
  px(bauTesouro.x, bauTesouro.y + 6, 24, 16, "#7c2d12");
  px(bauTesouro.x + 1, bauTesouro.y, 22, 7, "#c2410c");
  px(bauTesouro.x, bauTesouro.y + 6, 24, 2, "#fde047");
  px(bauTesouro.x + 10, bauTesouro.y + 4, 4, 6, "#fef08a");

  // Rajadas de fogo dracônico (ciano/dourado ou fogo punk)
  for (const f of projeteisDragao) {
    px(f.x - 1, f.y - 1, f.w + 2, f.h + 2, "#160b29");
    px(f.x, f.y, f.w, f.h, f.critico ? "#2dd4bf" : "#f97316");
    px(f.x + 2, f.y + 2, f.w - 4, f.h - 4, f.critico ? "#fef08a" : "#fde047");
  }

  // Flechas inimigas
  for (const fl of projeteisInimigos) {
    px(fl.x, fl.y, fl.w, fl.h, "#f8fafc");
    px(fl.vx < 0 ? fl.x : fl.x + fl.w - 2, fl.y - 1, 2, 5, "#f43f5e");
  }

  // Partículas
  for (const pt of particulas) {
    px(pt.x, pt.y, pt.tamanho, pt.tamanho, pt.cor);
  }
}

function desenharLavaFrente() {
  const onda = Math.floor(frameContador / 9) % 2;
  px(0, ALTURA_TELA - 16, LARGURA_TELA, 16, "#991b1b");
  px(0, ALTURA_TELA - 16, LARGURA_TELA, 4, "#ea580c");
  for (let lx = onda * 12; lx < LARGURA_TELA; lx += 24) {
    px(lx, ALTURA_TELA - 15, 10, 2, "#fde047");
  }
}

function desenhar() {
  ctx.save();
  ctx.scale(ESCALA_PIXEL, ESCALA_PIXEL);

  if (tremorTela > 0) {
    ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
  }

  // Fundo com paralaxe em camadas
  desenharCenarioParallax();

  // Mundo com câmera acompanhando o dragão nas fases longas
  ctx.save();
  ctx.translate(-Math.round(cameraX), 0);
  desenharPlataformas();
  desenharCristaisBauProjeteis();
  desenharGuerreiros();
  desenharDragao();
  ctx.restore();

  // Rio de lava brilhante na frente
  desenharLavaFrente();

  ctx.restore();
}

function loopPrincipal() {
  atualizar();
  desenhar();
  requestAnimationFrame(loopPrincipal);
}

// ============================================================
// EVENTOS DE TECLADO, TOQUE E PORTAL
// ============================================================
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "KeyA"].includes(e.code)) { e.preventDefault(); teclas.esquerda = true; }
  if (["ArrowRight", "KeyD"].includes(e.code)) { e.preventDefault(); teclas.direita = true; }
  if (["ArrowUp", "Space", "KeyW"].includes(e.code)) { e.preventDefault(); acionarPulo(); }
  if (["ShiftLeft", "ShiftRight", "KeyK"].includes(e.code)) { e.preventDefault(); acionarDash(); }
  if (["Enter", "KeyF", "KeyJ"].includes(e.code)) { e.preventDefault(); acionarAtaqueRitmo(); }
});

window.addEventListener("keyup", (e) => {
  if (["ArrowLeft", "KeyA"].includes(e.code)) teclas.esquerda = false;
  if (["ArrowRight", "KeyD"].includes(e.code)) teclas.direita = false;
});

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