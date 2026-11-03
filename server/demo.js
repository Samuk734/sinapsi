// Simulatore: si comporta come una sessione Claude Code che ha aperto Sinapsi.
// Produce hook e trascrizioni nello stesso formato di quelli veri, così la demo
// collauda tutta la catena (traduttore + trascrizioni), non solo la grafica.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const uid = () => Math.random().toString(16).slice(2, 10);
const MODELLI = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5', fable: 'claude-fable-5-1' };

class Stop extends Error {}

export class Demo {
  constructor({ traduttore, emit, azienda, config }) {
    Object.assign(this, { traduttore, emit, azienda, config });
    this.attiva = false;
    this.giro = 0;
  }

  avvia() {
    if (this.attiva) return;
    this.attiva = true;
    const giro = ++this.giro;
    this.emit({ type: 'demo', attiva: true });
    this.ciclo(giro).catch((e) => { if (!(e instanceof Stop)) console.error('[demo]', e); });
  }

  ferma() {
    if (!this.attiva) return;
    this.attiva = false;
    this.emit({ type: 'demo', attiva: false });
  }

  async pausa(ms, giro) {
    await attesa(ms);
    if (!this.attiva || giro !== this.giro) throw new Stop();
  }

  hook(p) {
    this.traduttore.hook({ session_id: this.sessione, transcript_path: this.trascrizione, cwd: 'C:/progetti/scheda-io', ...p });
  }

  async ciclo(giro) {
    this.sessione = `demo-${uid()}${uid()}`;
    const dir = path.join(os.tmpdir(), 'sinapsi-demo', 'C--progetti-scheda-io');
    this.dirSub = path.join(dir, this.sessione, 'subagents');
    fs.mkdirSync(this.dirSub, { recursive: true });
    this.trascrizione = path.join(dir, `${this.sessione}.jsonl`);
    this.hook({ hook_event_name: 'SessionStart', source: 'startup' });
    this.hook({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'sinapsi' }, tool_use_id: `toolu_${uid()}` });
    await this.pausa(1500, giro);
    for (;;) for (const s of SCENARI) { await s.call(this, giro); await this.pausa(7000, giro); }
  }

  async capoUsa(giro, tool, input) {
    const tool_use_id = `toolu_${uid()}`;
    this.hook({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, tool_use_id });
    await this.pausa(rnd(900, 1600), giro);
    this.hook({ hook_event_name: 'PostToolUse', tool_name: tool, tool_input: input, tool_use_id, tool_response: 'ok' });
  }

  // Ciclo di vita completo di un subagent, come lo vedrebbero hook e trascrizione.
  async lavoro(giro, s) {
    const tool_use_id = `toolu_${uid()}${uid()}`;
    const agent_id = `${uid()}${uid()}`;
    const input = { subagent_type: s.agente, description: s.titolo, prompt: s.prompt, model: s.model, effort: s.effort };
    const file = path.join(this.dirSub, `agent-${agent_id}.jsonl`);
    const scrivi = (content, usage) => fs.appendFileSync(file, JSON.stringify({
      type: 'assistant', isSidechain: true, sessionId: this.sessione, agentId: agent_id, timestamp: new Date().toISOString(),
      message: { id: `msg_${uid()}${uid()}`, role: 'assistant', model: MODELLI[s.model], content, usage },
    }) + '\n');

    this.hook({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id, tool_input: input });
    await this.pausa(rnd(500, 1000), giro);
    this.hook({ hook_event_name: 'SubagentStart', agent_id, agent_type: s.agente });
    await this.pausa(4200, giro); // tempo per timbrare e arrivare alla scrivania

    let contesto = rnd(6000, 11000);
    const inizio = Date.now();
    for (const p of s.passi) {
      contesto += rnd(800, 4000);
      const content = [{ type: 'thinking', thinking: p.pensiero || '' }];
      if (p.testo) content.push({ type: 'text', text: p.testo });
      scrivi(content, { input_tokens: rnd(200, 1800), output_tokens: rnd(120, 650), cache_read_input_tokens: contesto, cache_creation_input_tokens: rnd(300, 2500) });
      await this.pausa(rnd(1100, 1900), giro);
      this.hook({ hook_event_name: 'PreToolUse', agent_id, agent_type: s.agente, tool_name: p.tool, tool_input: p.input, tool_use_id: `toolu_${uid()}` });
      await this.pausa(rnd(1300, 2800), giro);
      this.hook({ hook_event_name: 'PostToolUse', agent_id, agent_type: s.agente, tool_name: p.tool, tool_input: p.input, tool_response: p.risultato, tool_use_id: `toolu_${uid()}` });
    }
    const b = s.busta;
    const testo = `${b.corpo}\n\n<busta>\nesito: ${b.esito || 'completato'}\naffidabilita: ${b.aff.toFixed(2)}\nrevisione: ${b.rev ? 'si' : 'no'}\nsintesi: ${b.sintesi}\n</busta>`;
    const usage = { input_tokens: rnd(200, 900), output_tokens: rnd(300, 900), cache_read_input_tokens: contesto, cache_creation_input_tokens: 0 };
    scrivi([{ type: 'text', text: testo }], usage);
    await this.pausa(1200, giro);
    this.hook({ hook_event_name: 'SubagentStop', agent_id, agent_type: s.agente, agent_transcript_path: file, last_assistant_message: testo, stop_hook_active: false });
    this.hook({
      hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id, tool_input: input,
      tool_response: {
        status: 'completed', agentId: agent_id, content: [{ type: 'text', text: testo }], resolvedModel: s.model,
        totalTokens: usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens,
        totalDurationMs: Date.now() - inizio, totalToolUseCount: s.passi.length, usage,
      },
    });
    return testo;
  }

  revisione(giro, reparto, titolo, busta, passi, verdetto) {
    return this.lavoro(giro, {
      agente: 'sinapsi-capo-reparto', model: 'sonnet', effort: 'low', titolo,
      prompt: `Reparto: ${reparto}. Busta da verificare:\n${busta}`, passi, busta: verdetto,
    });
  }
}

// ---------------------------------------------------------------------------
// Un passo di lavoro: pensiero, strumento, input, risultato
const P = (pensiero, tool, input, risultato) => ({ pensiero, tool, input, risultato });
const B = (aff, sintesi, corpo, rev = false) => ({ aff, sintesi, corpo, rev });

const SCENARI = [
  async function schedaMotore(giro) {
    this.hook({ hook_event_name: 'UserPromptSubmit', prompt: 'Progetta la nuova scheda di controllo per motore BLDC 48 V / 20 A: schema, PCB, firmware, contenitore, cablaggio e marcatura CE.' });
    await this.pausa(1500, giro);
    await this.capoUsa(giro, 'Read', { file_path: 'C:/progetti/bldc/specifiche/bldc_48v.md' });

    const [, , schema] = await Promise.all([
      this.lavoro(giro, {
        agente: 'sinapsi-ingegnere-calcoli', model: 'opus', effort: 'high', titolo: 'Dimensiona il ponte trifase',
        prompt: 'Calcola perdite e temperatura dei MOSFET del ponte trifase (specifiche in specifiche/bldc_48v.md) e dimensiona il dissipatore.',
        passi: [
          P('Parto dalle specifiche: 48 V nominali, 20 A continui, 40 A di picco per 2 s. Mi servono perdite di conduzione e di commutazione.', 'Read', { file_path: 'specifiche/bldc_48v.md' }, 'Vbus 36-60 V, Icont 20 A, Ipk 40 A/2 s, fpwm 20 kHz, Tamb max 55 °C'),
          P('Con Rds(on) di 3 mΩ e coefficiente 1,6 a 100 °C la conduzione vale circa 1,9 W per MOSFET. Lo scrivo in uno script invece di farlo a mente.', 'Write', { file_path: 'calcoli/perdite_ponte.py' }, 'Script scritto: 64 righe'),
          P('Calcolo il worst-case con la tolleranza di Rds(on) e Vbus a 60 V.', 'Bash', { command: 'python calcoli/perdite_ponte.py --worst', description: 'Calcola le perdite worst-case' }, 'Pcond 1.92 W, Psw 1.31 W, Ptot 3.23 W/MOSFET, Tj 112 °C'),
          P('Tj 112 °C con 55 °C ambiente: margine di 63 K su 175 °C. Il ponte richiede un dissipatore da almeno 2,4 K/W.', 'Bash', { command: 'python calcoli/dissipatore.py', description: 'Dimensiona il dissipatore' }, 'Rth richiesta 2.4 K/W, profilo 100x60x25 mm'),
        ],
        busta: B(0.91, 'Ponte: 3,2 W per MOSFET, Tj 112 °C, dissipatore 2,4 K/W', 'calcoli/perdite_ponte.py — Ptot 3,23 W per MOSFET (worst-case), Tj 112 °C a 55 °C ambiente.\nDissipatore: 2,4 K/W, profilo 100x60x25 mm.'),
      }),
      this.lavoro(giro, {
        agente: 'sinapsi-selezione-componenti', model: 'sonnet', effort: 'medium', titolo: 'Scegli MOSFET e gate driver',
        prompt: 'Proponi MOSFET 80 V e gate driver trifase per il ponte BLDC 48 V / 20 A, disponibili e attivi.',
        passi: [
          P('Cerco MOSFET da 80 V in package TOLL o D2PAK-7 sotto i 3 mΩ, attivi e disponibili.', 'WebSearch', { query: '80V MOSFET TOLL Rds(on) 2 mOhm AEC-Q101' }, '14 risultati: Infineon, onsemi, Nexperia, TI'),
          P('Confronto i tre candidati migliori sul datasheet del produttore: Rds(on), Qg, resistenza termica.', 'WebFetch', { url: 'https://www.infineon.com/dgdl/IPT015N08NM5.pdf' }, 'Rds(on) 1.5 mΩ, Qg 115 nC, TOLL, AEC-Q101'),
          P('Serve un driver trifase con bootstrap e protezione da sovracorrente integrata.', 'WebSearch', { query: 'three phase gate driver 60V bootstrap overcurrent protection' }, 'DRV8353, 6EDL7141, MP6539'),
          P('Verifico disponibilità e ciclo di vita presso i distributori.', 'WebFetch', { url: 'https://www.mouser.it/c/?q=DRV8353RS' }, 'DRV8353RS: attivo, 2.340 pz a magazzino'),
        ],
        busta: B(0.87, 'MOSFET IPT015N08NM5 e driver DRV8353RS, disponibili', '| Parte | Ruolo | Stato |\n| IPT015N08NM5 | MOSFET 80 V 1,5 mΩ | attivo |\n| DRV8353RS | gate driver trifase | attivo, 2.340 pz |'),
      }),
      this.lavoro(giro, {
        agente: 'sinapsi-progettista-schematici', model: 'opus', effort: 'high', titolo: 'Disegna lo schema di potenza',
        prompt: 'Disegna in hw/bldc.kicad_sch il foglio di potenza: ponte trifase, shunt, bulk, bootstrap, amplificatori di corrente.',
        passi: [
          P('Imposto il foglio di potenza: ponte trifase, shunt sul ritorno, condensatori di bulk e snubber.', 'Read', { file_path: 'hw/bldc.kicad_sch' }, 'Foglio vuoto, template aziendale caricato'),
          P('Il DRV8353 vuole condensatori di bootstrap da almeno 1 µF: lo verifico sul datasheet.', 'WebFetch', { url: 'https://www.ti.com/lit/ds/symlink/drv8353.pdf' }, 'Cboot ≥ 1 µF 16 V (pag. 54), VGLS 10.5 V'),
          P('Aggiungo ponte, shunt da 1 mΩ e amplificatori di corrente con guadagno 20.', 'Edit', { file_path: 'hw/bldc.kicad_sch' }, '42 componenti aggiunti, 118 net'),
          P("Lancio l'ERC per pin scollegati e conflitti di alimentazione.", 'Bash', { command: 'kicad-cli sch erc hw/bldc.kicad_sch', description: "Esegue l'ERC" }, '0 errori, 3 avvisi (pin NC intenzionali)'),
        ],
        busta: B(0.78, 'Schema di potenza completo, ERC pulito', 'hw/bldc.kicad_sch — ponte Q1-Q6, shunt R20-R22 1 mΩ, Cboot C30-C32 1 µF.\nERC: 0 errori. Da rivedere: tensione dei bootstrap a Vbus minima.', true),
      }),
      this.lavoro(giro, {
        agente: 'sinapsi-fisico', model: 'opus', effort: 'high', titolo: 'Simula la termica della scheda',
        prompt: 'Simula la distribuzione di temperatura della scheda con 6 MOSFET da 3,2 W e il dissipatore da 2,4 K/W.',
        passi: [
          P('Modello la scheda come piastra con 6 sorgenti da 3,2 W e convezione naturale verso il dissipatore.', 'Write', { file_path: 'sim/termica_pcb.py' }, 'Modello alle differenze finite 200x120'),
          P('Stima analitica prima di simulare: 19,4 W su 2,4 K/W fanno circa 47 K di salita.', 'Bash', { command: 'python sim/termica_pcb.py', description: 'Esegue la simulazione termica' }, 'Tmax 101 °C su Q4, ΔT medio 46 K'),
          P('Controllo la convergenza dimezzando il passo di griglia.', 'Bash', { command: 'python sim/termica_pcb.py --griglia 400x240', description: 'Verifica la convergenza' }, 'Tmax 102 °C (Δ 1 %), convergente'),
        ],
        busta: B(0.84, 'Tmax 102 °C su Q4, coerente con il calcolo', 'sim/termica_pcb.py — Tmax 102 °C su Q4, ΔT medio 46 K, convergenza entro 1 %.'),
      }),
      this.lavoro(giro, {
        agente: 'sinapsi-disegnatore-meccanico', model: 'sonnet', effort: 'medium', titolo: 'Disegna il contenitore',
        prompt: 'Modella in OpenSCAD il contenitore per scheda 120x80 mm con dissipatore 100x60x25 e passacavi.',
        passi: [
          P("Parto dall'ingombro della scheda 120x80 mm e dal dissipatore 100x60x25.", 'Write', { file_path: 'mecc/contenitore.scad' }, 'Modello parametrico, 38 parametri'),
          P("Prevedo le alette di ventilazione e i passacavi per le tre fasi e l'alimentazione.", 'Edit', { file_path: 'mecc/contenitore.scad' }, '4 passacavi M20, griglia di ventilazione'),
          P('Esporto in STL e controllo che il modello sia chiuso.', 'Bash', { command: 'openscad -o out/contenitore.stl mecc/contenitore.scad', description: 'Esporta il modello' }, 'STL: 18.432 triangoli, manifold'),
        ],
        busta: B(0.82, 'Contenitore 140x100x55 mm con passacavi M20', 'mecc/contenitore.scad — 140x100x55 mm, 4 passacavi M20, griglia di ventilazione. Misure dei connettori stimate.'),
      }),
      this.lavoro(giro, {
        agente: 'sinapsi-consulente-normative', model: 'sonnet', effort: 'high', titolo: 'Piano per la marcatura CE',
        prompt: 'Indica direttive e norme applicabili a un azionamento BLDC 48 V e prepara il piano di prove.',
        passi: [
          P('Un azionamento a 48 V rientra nella direttiva EMC; la LVD non si applica sotto i 75 V DC. Lo verifico.', 'WebSearch', { query: 'LVD 2014/35/EU voltage limits 75 V DC' }, 'Campo LVD: 50-1000 V AC, 75-1500 V DC'),
          P("Per gli azionamenti la norma EMC di prodotto è la EN IEC 61800-3: controllo l'edizione armonizzata.", 'WebFetch', { url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=OJ:L_2023' }, 'EN IEC 61800-3:2023 armonizzata'),
          P('Preparo le prove e i documenti del fascicolo tecnico.', 'Write', { file_path: 'ce/piano_prove.md' }, '9 prove, 14 documenti'),
        ],
        busta: B(0.88, 'EMC con EN IEC 61800-3:2023, LVD non applicabile', 'ce/piano_prove.md — direttiva EMC 2014/30/UE, norma EN IEC 61800-3:2023, 9 prove. RoHS: dichiarazioni dei fornitori.'),
      }),
    ]);

    await this.revisione(giro, 'schematici', 'Rivedi i bootstrap', schema, [
      P('Verifico la tensione dei bootstrap con Vbus al minimo di 36 V e duty massimo.', 'Read', { file_path: 'hw/bldc.kicad_sch' }, 'Cboot 1 µF, VGLS 10.5 V, duty max 95 %'),
      P('Con duty al 95 % a 20 kHz il bootstrap resta sopra la soglia UVLO: ok.', 'Bash', { command: 'python calcoli/bootstrap.py', description: 'Verifica i bootstrap' }, 'Vboot min 9.8 V > UVLO 8.1 V'),
    ], B(0.9, 'Confermato: bootstrap sopra UVLO anche al 95 %', 'Confermato. Vboot minima 9,8 V contro UVLO 8,1 V.'));

    const [pcb, fw] = await Promise.all([
      this.lavoro(giro, {
        agente: 'sinapsi-progettista-pcb', model: 'sonnet', effort: 'high', titolo: 'Layout del ponte di potenza',
        prompt: 'Fai il layout della sezione di potenza in hw/bldc.kicad_pcb: 4 strati, 2 oz esterni, MOSFET sul bordo dissipatore.',
        passi: [
          P('Metto i MOSFET in fila sul bordo del dissipatore e chiudo al minimo gli anelli di commutazione.', 'Read', { file_path: 'hw/bldc.kicad_pcb' }, 'Scheda 120x80 mm, 4 strati'),
          P('Stackup: 2 oz sugli esterni, piani di massa continui sugli interni sotto il ponte.', 'Edit', { file_path: 'hw/bldc.kicad_pcb' }, 'Stackup aggiornato'),
          P('Larghezza delle piste di fase per 20 A con aumento di 20 °C secondo IPC-2152.', 'Bash', { command: 'python tools/ipc2152.py 20 --dt 20 --oz 2', description: 'Calcola la larghezza delle piste' }, 'Minimo 7.8 mm su esterno 2 oz'),
          P('Lancio il DRC con le regole del produttore.', 'Bash', { command: 'kicad-cli pcb drc hw/bldc.kicad_pcb', description: 'Esegue il DRC' }, '0 errori, 2 avvisi di serigrafia'),
        ],
        busta: B(0.83, 'Layout di potenza fatto, DRC pulito', 'hw/bldc.kicad_pcb — piste di fase 8 mm, anello di commutazione stimato 1,8 nH, DRC 0 errori.', true),
      }),
      this.lavoro(giro, {
        agente: 'sinapsi-dev-embedded', model: 'sonnet', effort: 'high', titolo: 'PWM e lettura delle correnti',
        prompt: 'Configura la PWM complementare a 20 kHz con tempo morto e la lettura degli shunt sincronizzata.',
        passi: [
          P('Imposto il timer avanzato per PWM complementare center-aligned a 20 kHz.', 'Read', { file_path: 'fw/src/pwm.c' }, 'Timer TIM1, center-aligned'),
          P('Il tempo morto deve coprire lo spegnimento: 115 nC con il driver a 1 A sono circa 120 ns. Tengo 300 ns.', 'Edit', { file_path: 'fw/src/pwm.c' }, 'DTG = 0x2E (300 ns)'),
          P('Aggiungo il campionamento degli shunt a metà periodo PWM.', 'Edit', { file_path: 'fw/src/adc.c' }, 'Trigger ADC su TIM1 CH4'),
          P('Compilo.', 'Bash', { command: 'make -j8', description: 'Compila il firmware' }, 'Build OK: 46 KB flash, 9 KB RAM'),
        ],
        busta: B(0.8, 'PWM 20 kHz, tempo morto 300 ns, ADC sincronizzato', 'fw/src/pwm.c:41 DTG 300 ns; fw/src/adc.c:88 trigger su TIM1 CH4. Build OK. Non provato su banco.', true),
      }),
      this.lavoro(giro, {
        agente: 'sinapsi-progettista-cablaggi', model: 'sonnet', effort: 'high', titolo: 'Cablaggio motore e alimentazione',
        prompt: 'Dimensiona i cavi di fase e alimentazione e prepara lista cavi e pinout dei connettori.',
        passi: [
          P('Cavi di fase: 20 A continui in canalina a 40 °C, tre conduttori raggruppati.', 'Bash', { command: 'python tools/sezioni.py 20 --posa B2 --t 40 --n 3', description: 'Calcola le sezioni dei cavi' }, 'Minimo 2.5 mm², scelto 4 mm² per caduta < 1 %'),
          P('Preparo la lista cavi e il pinout dei connettori.', 'Write', { file_path: 'cablaggi/lista_cavi.csv' }, '12 cavi, 3 connettori'),
        ],
        busta: B(0.9, 'Fasi in 4 mm², lista cavi pronta', 'cablaggi/lista_cavi.csv — fasi 4 mm², alimentazione 6 mm², 3 connettori.'),
      }),
    ]);

    await Promise.all([
      this.revisione(giro, 'pcb', 'Rivedi il layout di potenza', pcb, [
        P('Controllo che sotto le piste di fase il piano di massa sia continuo.', 'Bash', { command: 'python tools/piani.py hw/bldc.kicad_pcb', description: 'Analizza i piani' }, 'Nessun taglio sotto le net di fase'),
      ], B(0.92, 'Confermato: piani continui, anelli corti', 'Confermato. Piani continui, anello di commutazione corto.')),
      this.revisione(giro, 'software', 'Rivedi PWM e ADC', fw, [
        P("Verifico che il trigger ADC cada a metà dell'impulso basso.", 'Read', { file_path: 'fw/src/adc.c' }, 'CCR4 = ARR - 1: campionamento al centro'),
      ], B(0.88, 'Confermato, da provare al banco', 'Confermato. Campionamento centrato, tempo morto adeguato.')),
    ]);

    this.traduttore.eventoDiretto({ type: 'vacancy', reparto: 'normative', ruolo: 'Esperto EMC e filtri', modello: 'opus',
      motivo: "Le prove EMC degli azionamenti richiedono filtri d'ingresso dedicati: conviene uno specialista." });
    await this.capoUsa(giro, 'TodoWrite', {});
  },

  async function bootBloccato(giro) {
    this.hook({ hook_event_name: 'UserPromptSubmit', prompt: "Dopo l'aggiornamento la scheda I/O si pianta al boot: trova la causa e sistemala." });
    await this.pausa(1500, giro);
    await this.capoUsa(giro, 'Read', { file_path: 'C:/progetti/scheda-io/CHANGELOG.md' });

    const [, guasti] = await Promise.all([
      this.lavoro(giro, {
        agente: 'sinapsi-esploratore', model: 'haiku', effort: 'low', titolo: 'Mappa la sequenza di boot',
        prompt: 'Ricostruisci la sequenza di boot da Reset_Handler a main loop in C:/progetti/scheda-io. Riporta file:riga.',
        passi: [
          { pensiero: 'Parto da Reset_Handler nello startup, poi seguo SystemInit e main().', tool: 'Grep', input: { pattern: 'SystemInit' }, risultato: 'startup/startup_LPC17xx.s:118\nsrc/system_LPC17xx.c:412' },
          { pensiero: 'Controllo la configurazione del clock in SystemInit.', tool: 'Read', input: { file_path: 'src/system_LPC17xx.c' }, risultato: 'PLL0 a 100 MHz, FLASHCFG = 0x403A' },
          { pensiero: 'Cerco dove viene inizializzato e alimentato il watchdog.', tool: 'Grep', input: { pattern: 'WDT_Init|wdt_feed' }, risultato: 'src/main.c:58  WDT_Init(2000);\nsrc/app/scheduler.c:131  wdt_feed();' },
        ],
        busta: { aff: 0.93, rev: false, sintesi: 'Boot: SystemInit, clock 100 MHz, WDT 2 s, scheduler',
          corpo: '- startup/startup_LPC17xx.s:118 — Reset_Handler chiama SystemInit\n- src/system_LPC17xx.c:412 — PLL0 a 100 MHz\n- src/main.c:58 — WDT_Init(2000) prima delle periferiche\n- src/app/scheduler.c:131 — primo wdt_feed() solo dopo eeprom_load()' },
      }),
      this.lavoro(giro, {
        agente: 'sinapsi-analista-guasti', model: 'opus', effort: 'high', titolo: 'Analizza il log del crash',
        prompt: 'Analizza logs/boot_fail.txt e il codice di avvio: formula ipotesi sul blocco al boot.',
        passi: [
          { pensiero: "Il log si ferma subito dopo 'eeprom...'. Prima ipotesi: watchdog che scatta durante un'inizializzazione lenta.", tool: 'Read', input: { file_path: 'logs/boot_fail.txt' }, risultato: '[0.000] boot v2.4.1\n[0.012] clk ok\n[0.015] eeprom...\n[2.003] boot v2.4.1' },
          { pensiero: 'Il riavvio dopo circa 2 s coincide con il timeout del WDT. Verifico se il firmware registra la causa del reset.', tool: 'Grep', input: { pattern: 'RSID' }, risultato: 'src/main.c:44  if (LPC_SC->RSID & 0x04) log("WDT reset");' },
          { pensiero: 'Conto i reset da watchdog nel log completo.', tool: 'Bash', input: { command: 'grep -c "WDT reset" logs/boot_fail.txt', description: 'Conta i reset da watchdog' }, risultato: '37' },
        ],
        busta: { aff: 0.72, rev: true, sintesi: 'Probabile reset da watchdog durante eeprom_load()',
          corpo: 'Ipotesi 1 (alta): eeprom_load() supera i 2 s del WDT. 37 reset WDT nel log, riavvio a 2,003 s.\nIpotesi 2 (bassa): brown-out all\'avvio, non supportata dal log.\nDa verificare: durata reale di eeprom_load() nel caso peggiore.' },
      }),
    ]);

    await this.revisione(giro, 'diagnostica', "Verifica l'ipotesi watchdog", guasti, [
      { pensiero: 'Verifico la durata di eeprom_load() nel caso peggiore leggendo il driver.', tool: 'Read', input: { file_path: 'src/drivers/eeprom.c' }, risultato: 'timeout I2C 50 ms per pagina, 64 pagine: 3,2 s nel caso peggiore' },
    ], { aff: 0.88, rev: false, sintesi: 'Corretto: eeprom_load fino a 3,2 s, oltre i 2 s del WDT',
      corpo: "Corretto. L'ipotesi watchdog è confermata: con EEPROM lenta eeprom_load() arriva a 3,2 s, oltre il timeout di 2 s. Il brown-out si può escludere." });

    const fix = await this.lavoro(giro, {
      agente: 'sinapsi-dev-embedded', model: 'sonnet', effort: 'high', titolo: 'Correggi il watchdog al boot',
      prompt: 'Il WDT (2 s) scatta durante eeprom_load() (fino a 3,2 s). Correggi senza disattivare il watchdog. File: src/drivers/eeprom.c, src/main.c.',
      passi: [
        { pensiero: 'Non devo disattivare il watchdog: lo alimento durante la lettura, una volta per pagina.', tool: 'Read', input: { file_path: 'src/drivers/eeprom.c' }, risultato: 'for (p = 0; p < EE_PAGES; p++) { i2c_read_page(p, buf); }' },
        { pensiero: 'Inserisco wdt_feed() nel ciclo: 50 ms per pagina sono ben sotto il timeout.', tool: 'Edit', input: { file_path: 'src/drivers/eeprom.c' }, risultato: 'Modifica applicata (riga 87)' },
        { pensiero: 'Compilo per verificare.', tool: 'Bash', input: { command: 'make -j8', description: 'Compila il firmware' }, risultato: 'Build OK: firmware.bin 118 KB, 0 warning' },
      ],
      busta: { aff: 0.86, rev: true, sintesi: 'wdt_feed() per pagina in eeprom_load, build ok',
        corpo: '- src/drivers/eeprom.c:87 — wdt_feed() a ogni pagina letta (50 ms max)\nBuild OK. Non provato su scheda. Codice di boot: chiedo revisione.' },
    });

    await Promise.all([
      this.revisione(giro, 'software', 'Rivedi la correzione del boot', fix, [
        { pensiero: 'Controllo che wdt_feed sia sicuro da chiamare prima che lo scheduler parta.', tool: 'Grep', input: { pattern: 'void wdt_feed' }, risultato: 'src/drivers/wdt.c:22  void wdt_feed(void) { LPC_WDT->WDFEED = 0xAA; LPC_WDT->WDFEED = 0x55; }' },
      ], { aff: 0.94, rev: false, sintesi: 'Confermato: correzione minima e sicura',
        corpo: 'Confermato. wdt_feed() è atomico e non dipende dallo scheduler. Il diff tocca solo eeprom.c.' }),
      this.lavoro(giro, {
        agente: 'sinapsi-tester', model: 'haiku', effort: 'low', titolo: 'Esegui i test',
        prompt: 'Compila ed esegui la suite di test (make test) in C:/progetti/scheda-io.',
        passi: [{ pensiero: 'Lancio la suite di test.', tool: 'Bash', input: { command: 'make test', description: 'Esegue i test' }, risultato: '42 passati, 0 falliti' }],
        busta: { aff: 0.97, rev: false, sintesi: '42 test passati, 0 falliti', corpo: 'make test: 42 passati, 0 falliti.' },
      }),
    ]);

    this.traduttore.eventoDiretto({ type: 'vacancy', reparto: 'software', ruolo: 'Specialista bootloader e IAP', modello: 'opus',
      motivo: 'Due incarichi su boot e flash hanno richiesto revisione: conviene uno specialista dedicato.' });
    await this.capoUsa(giro, 'TodoWrite', {});
  },

  async function manualeModbus(giro) {
    this.hook({ hook_event_name: 'UserPromptSubmit', prompt: 'Documenta il protocollo Modbus del modulo I/O per il cliente.' });
    await this.pausa(1500, giro);
    const [mappa, spec] = await Promise.all([
      this.lavoro(giro, {
        agente: 'sinapsi-esploratore', model: 'haiku', effort: 'low', titolo: 'Trova la mappa registri Modbus',
        prompt: 'Trova la mappa dei registri Modbus e i function code gestiti in src/modbus.',
        passi: [
          { pensiero: 'Cerco le definizioni dei registri.', tool: 'Grep', input: { pattern: 'MB_REG_' }, risultato: 'src/modbus/regmap.h: 24 registri (0x0000-0x0017)' },
          { pensiero: 'Ora i function code gestiti dal dispatcher.', tool: 'Grep', input: { pattern: 'case MB_FC_' }, risultato: 'src/modbus/slave.c:140 FC03, :162 FC06, :181 FC16' },
        ],
        busta: { aff: 0.95, rev: false, sintesi: '24 registri, function code 03/06/16', corpo: '- src/modbus/regmap.h — 24 registri 0x0000-0x0017\n- src/modbus/slave.c:140-181 — FC03, FC06, FC16' },
      }),
      this.lavoro(giro, {
        agente: 'sinapsi-documentalista', model: 'sonnet', effort: 'medium', titolo: 'Verifica la specifica Modbus RTU',
        prompt: 'Riassumi dalla specifica ufficiale Modbus i formati di FC03, FC06, FC16 e i codici di eccezione.',
        passi: [
          { pensiero: 'Cerco la specifica ufficiale, non i blog.', tool: 'WebSearch', input: { query: 'Modbus Application Protocol Specification V1.1b3' }, risultato: 'modbus.org — Modbus_Application_Protocol_V1_1b3.pdf' },
          { pensiero: 'Leggo le sezioni 6.3, 6.6 e 6.12 e la tabella delle eccezioni.', tool: 'WebFetch', input: { url: 'https://modbus.org/docs/Modbus_Application_Protocol_V1_1b3.pdf' }, risultato: 'FC03 max 125 registri; FC16 max 123; eccezioni 01-04' },
        ],
        busta: { aff: 0.91, rev: false, sintesi: 'Formati FC03/06/16 ed eccezioni dalla specifica ufficiale', corpo: 'Fonte: modbus.org V1.1b3, sezioni 6.3/6.6/6.12. FC03 fino a 125 registri, FC16 fino a 123.' },
      }),
    ]);
    await this.lavoro(giro, {
      agente: 'sinapsi-redattore', model: 'sonnet', effort: 'low', titolo: 'Scrivi il manuale Modbus',
      prompt: `Scrivi docs/modbus.md per il cliente. Dati:\n${mappa}\n${spec}`,
      passi: [
        { pensiero: 'Riporto i registri con indirizzo, accesso e unità leggendoli dal file.', tool: 'Read', input: { file_path: 'src/modbus/regmap.h' }, risultato: '24 #define con commenti di unità e accesso' },
        { pensiero: 'Scrivo il manuale: introduzione, cablaggio, tabella registri, esempi di trama.', tool: 'Write', input: { file_path: 'docs/modbus.md' }, risultato: 'File scritto: 214 righe' },
      ],
      busta: { aff: 0.84, rev: false, sintesi: 'Manuale Modbus scritto: docs/modbus.md', corpo: 'docs/modbus.md (214 righe): registri, function code, eccezioni, 3 esempi di trama. Non verificati i limiti elettrici RS-485.' },
    });
  },
];
