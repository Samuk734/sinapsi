import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Interruttore di Sinapsi: pannello accanto alla chat (app desktop) e comando /sinapsi-interruttore.
// Spento: gli impiegati sinapsi:* spariscono dall'elenco degli agenti
// (niente token fissi) e la skill del Capo risponde solo che Sinapsi è spento.
// Lo stato resta tra le sessioni ($.store).
const PANE = 'sinapsi'
const acceso = atom({ plugin: 'sinapsi', key: 'acceso' } as const, true)
const diSinapsi = (agente: string, plugin?: string) => plugin === 'sinapsi' || agente.startsWith('sinapsi:')

export const register: Register = (on) => {
  // il pannello si apre all'avvio; se l'app non lo posiziona, riprova al messaggio successivo
  let posizionato = false

  on('session.start', async ($, e, next) => {
    const salvato = await $.store.get('acceso')
    if (typeof salvato === 'boolean') await update($, acceso, () => salvato)
    $.ui.status(salvato === false ? 'Sinapsi ○ spento' : 'Sinapsi ● acceso')
    await $.command.register({ name: 'sinapsi-interruttore', description: 'Accende o spegne Sinapsi' })
    const r = await $.ui.open({ id: PANE, title: 'Sinapsi' })
    posizionato = r.isPlaced
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (!posizionato) {
      const r = await $.ui.open({ id: PANE, title: 'Sinapsi' })
      posizionato = r.isPlaced
    }
    return next(e)
  })

  on('command.run', { command: 'sinapsi-interruttore' }, async ($) => {
    const ora = !(await read($, acceso))
    await update($, acceso, () => ora)
    await $.store.set('acceso', ora)
    $.ui.status(ora ? 'Sinapsi ● acceso' : 'Sinapsi ○ spento')
    // l'elenco degli agenti va ricostruito: costa una sola rottura della cache del prompt
    $.ui.invalidate('tool.describe')
    $.ui.invalidate('prompt.attachment')
    void $.ui.open({ id: PANE, title: 'Sinapsi' })
    return { text: ora ? 'Sinapsi acceso.' : 'Sinapsi spento.' }
  })

  on('agent.offer', async ($, e, next) => {
    if (diSinapsi(e.agent, e.provider?.plugin) && !(await read($, acceso))) return { isOffered: false }
    return next(e)
  })

  on('skill.prompt', async ($, e, next) => {
    if (e.pluginName === 'sinapsi' && !(await read($, acceso))) {
      return { text: "Sinapsi è spento dal pannello dell'app. Dillo all'utente in una riga: per usarlo va riacceso dal pannello Sinapsi o con /sinapsi-interruttore." }
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const si = await read($, acceso)
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{si ? '● Sinapsi acceso' : '○ Sinapsi spento'}</Text>
        <Text dimColor>
          {si ? 'Il Capo e gli impiegati sono disponibili in questa sessione.' : 'Impiegati e skill del Capo nascosti: zero token fissi.'}
        </Text>
        <Button key="interruttore" label={si ? 'Spegni Sinapsi' : 'Accendi Sinapsi'} onPress={async () => {
          await update($, acceso, () => !si)
          await $.store.set('acceso', !si)
          $.ui.status(si ? 'Sinapsi ○ spento' : 'Sinapsi ● acceso')
          $.ui.invalidate('tool.describe')
          $.ui.invalidate('prompt.attachment')
          $.ui.toast(si ? 'Sinapsi spento: impiegati e skill del Capo nascosti' : 'Sinapsi acceso')
        }} />
      </Box>
    )
  })
}
