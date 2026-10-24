import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleAlert,
  Clapperboard, Clock3, Copy, ExternalLink, Film, Image as ImageIcon,
  Images, Link2, LoaderCircle, Play, Plus, Sparkles, Trash2, UploadCloud, WandSparkles,
} from 'lucide-react'
import { api } from './api'
import type { Job, Mode, ProviderStatus } from './types'

const inspirations = [
  {
    title: 'Última luz',
    kind: 'Paisagem cinematográfica',
    image: '/scenes/solstice.svg',
    prompt: 'Uma viajante solitária atravessa dunas rosadas ao pôr do sol, horizonte imenso, luz dourada suave, composição cinematográfica, textura de filme analógico',
  },
  {
    title: 'Maré baixa',
    kind: 'Natureza em movimento',
    image: '/scenes/tidal.svg',
    prompt: 'Falésias e ondas azul-esverdeadas ao amanhecer, névoa costeira, luz natural delicada, fotografia de cinema contemplativa',
  },
  {
    title: 'Depois das luzes',
    kind: 'Cidade noturna',
    image: '/scenes/nocturne.svg',
    prompt: 'Uma cidade silenciosa ao anoitecer, janelas iluminadas sob um céu violeta, arquitetura geométrica, atmosfera melancólica de filme',
  },
  {
    title: 'Entre folhas',
    kind: 'Detalhe orgânico',
    image: '/scenes/botanical.svg',
    prompt: 'Folhas tropicais iluminadas por uma janela, verdes profundos, sombras delicadas, fotografia editorial com foco suave',
  },
]

const ratios = [
  { value: '16:9', label: 'Paisagem', shape: 'wide' },
  { value: '1:1', label: 'Quadrado', shape: 'square' },
  { value: '9:16', label: 'Retrato', shape: 'tall' },
] as const

const statusLabels: Record<Job['status'], string> = {
  queued: 'Na fila',
  running: 'Criando',
  completed: 'Pronto',
  failed: 'Falhou',
  interrupted: 'Interrompido',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function isPending(job: Job) {
  return job.status === 'queued' || job.status === 'running'
}

function JobVisual({ job, className = '' }: { job: Job; className?: string }) {
  if (job.status === 'completed' && job.outputUrl) {
    if (job.mode === 'image') return <img className={className} src={job.outputUrl} alt={job.prompt} loading="lazy" />
    return <div className={`video-art ${className}`}><Film size={34} strokeWidth={1.4} /><span>Vídeo criado</span></div>
  }
  return <div className={`job-placeholder ${className}`}>
    {isPending(job) ? <LoaderCircle className="spin" size={32} strokeWidth={1.5} /> : <CircleAlert size={30} strokeWidth={1.5} />}
  </div>
}

function App() {
  const [view, setView] = useState<'create' | 'library'>('create')
  const [mode, setMode] = useState<Mode>('image')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<Job['aspectRatio']>('16:9')
  const [duration, setDuration] = useState('5')
  const [resolution, setResolution] = useState<NonNullable<Job['resolution']>>('720p')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [seed, setSeed] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [provider, setProvider] = useState<ProviderStatus | null>(null)
  const [connectionError, setConnectionError] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [accessReady, setAccessReady] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [selectedInspiration, setSelectedInspiration] = useState(0)
  const [filter, setFilter] = useState<'all' | Mode>('all')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    let live = true
    function refresh() {
      api.status()
        .then(async (status) => [status, await api.jobs()] as const)
        .then(([status, history]) => {
          if (!live) return
          setProvider(status)
          setJobs(history)
          setConnectionError(false)
        })
        .catch(() => { if (live) setConnectionError(true) })
    }
    refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => { live = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!provider?.authRequired) return
    if (!api.hasAccessToken()) { setAccessReady(false); return }
    let live = true
    api.verifyAccess()
      .then(() => { if (live) setAccessReady(true) })
      .catch(() => {
        api.clearAccessToken()
        if (live) setAccessReady(false)
      })
    return () => { live = false }
  }, [provider?.authRequired])

  const hasPending = jobs.some(isPending)
  useEffect(() => {
    if (!hasPending) return
    const timer = window.setInterval(() => {
      api.jobs().then(setJobs).catch(() => setConnectionError(true))
    }, 3500)
    return () => window.clearInterval(timer)
  }, [hasPending])

  useEffect(() => {
    if (!selectedJobId) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedJobId(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedJobId])

  const activeJob = jobs.find((job) => job.id === activeJobId)
  const selectedJob = jobs.find((job) => job.id === selectedJobId)
  const completedImages = jobs.filter((job) => job.mode === 'image' && job.status === 'completed' && job.outputUrl)
  const visibleJobs = useMemo(() => jobs.filter((job) => filter === 'all' || (filter === 'video' ? job.mode !== 'image' : job.mode === filter)), [jobs, filter])
  const scene = inspirations[selectedInspiration]

  async function connectAccess() {
    if (!accessCode.trim()) { setAccessError('Informe o código de acesso do estúdio.'); return }
    setAccessError('')
    api.setAccessToken(accessCode.trim())
    try {
      await api.verifyAccess()
      setAccessReady(true)
      setAccessCode('')
      setJobs(await api.jobs())
      setNotice('Acesso ao estúdio confirmado.')
    } catch {
      api.clearAccessToken()
      setAccessReady(false)
      setAccessError('Código de acesso inválido ou servidor indisponível.')
    }
  }

  function useInspiration(index: number) {
    setSelectedInspiration(index)
    setPrompt(inspirations[index].prompt)
    setMode('image')
    setActiveJobId(null)
    setFormError('')
    setNotice('Descrição adicionada. Ajuste os detalhes antes de criar.')
    setView('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function useAsReference(job: Job) {
    if (!job.outputUrl) return
    setMode('animate')
    setReferenceUrl(job.outputUrl)
    setPrompt('Movimento suave de câmera, luz cinematográfica e detalhes naturais em movimento')
    setActiveJobId(job.id)
    setSelectedJobId(null)
    setFormError('')
    setNotice('Imagem selecionada como referência para o vídeo.')
    setView('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function uploadReference(file?: File) {
    if (!file) return
    setFormError('')
    setNotice('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormError('Escolha uma imagem JPEG, PNG ou WebP.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setFormError('Escolha uma imagem de até 20 MB.')
      return
    }
    if (connectionError || !provider?.configured) {
      setFormError('Configure sua chave da API antes de enviar uma imagem.')
      return
    }
    if (provider?.authRequired && !accessReady) {
      setFormError('Informe o código de acesso antes de enviar uma imagem.')
      return
    }
    setUploading(true)
    try {
      const url = await api.uploadImage(file)
      setReferenceUrl(url)
      setNotice('Imagem enviada e pronta para animar.')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    } finally {
      setUploading(false)
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  async function generate() {
    setFormError('')
    setNotice('')
    if (connectionError || !provider) {
      setFormError('Não foi possível falar com o servidor. Confira se npm run dev está em execução.')
      return
    }
    if (!provider.configured) {
      setFormError(provider.authRequired ? 'O deploy precisa das variáveis HF_CREDENTIALS e MOVIX_ACCESS_TOKEN na Vercel.' : 'Configure HF_CREDENTIALS em .env.local e reinicie o servidor.')
      return
    }
    if (provider.authRequired && !accessReady) {
      setFormError('Informe o código de acesso ao estúdio antes de criar.')
      return
    }
    if (prompt.trim().length < 3) {
      setFormError('Descreva a cena em pelo menos 3 caracteres.')
      return
    }
    if (mode === 'animate' && !referenceUrl.trim()) {
      setFormError('Escolha uma imagem criada ou cole a URL pública de uma imagem.')
      return
    }
    if (mode === 'video' && (!Number.isInteger(Number(duration)) || Number(duration) < 4 || Number(duration) > 30)) {
      setFormError('Escolha uma duração de 4 a 30 segundos.')
      return
    }
    if (mode !== 'video' && seed && (!Number.isInteger(Number(seed)) || Number(seed) < 0 || Number(seed) > 2147483647)) {
      setFormError('A semente deve ser um número inteiro entre 0 e 2147483647.')
      return
    }

    setSubmitting(true)
    try {
      const job = await api.create({
        mode,
        prompt: prompt.trim(),
        ...(mode === 'image' ? { aspectRatio } : mode === 'video' ? { aspectRatio, duration: Number(duration), resolution } : { referenceUrl: referenceUrl.trim() }),
        ...(mode !== 'video' && seed ? { seed: Number(seed) } : {}),
      })
      setJobs((current) => [job, ...current])
      setActiveJobId(job.id)
      setNotice('Criação enviada. O resultado aparecerá aqui e na biblioteca.')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível enviar a criação.')
    } finally {
      setSubmitting(false)
    }
  }

  async function removeJob(job: Job) {
    if (!window.confirm('Remover esta criação do histórico local? O arquivo no provedor não será apagado.')) return
    try {
      await api.remove(job.id)
      setJobs((current) => current.filter((item) => item.id !== job.id))
      if (activeJobId === job.id) setActiveJobId(null)
      setSelectedJobId(null)
      setNotice('Criação removida do histórico local.')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível remover a criação.')
      setSelectedJobId(null)
    }
  }

  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(true)
      window.setTimeout(() => setCopySuccess(false), 2200)
    } catch {
      setCopySuccess(false)
    }
  }

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Navegação principal">
      <button className="brand" onClick={() => setView('create')} aria-label="MOVIX Studio, ir para criar">
        <span className="brand-mark"><span>m</span><i /></span>
        <span className="brand-name">movix<span>studio</span></span>
      </button>

      <div className="sidebar-group">
        <p className="sidebar-label">Espaço de trabalho</p>
        <nav className="navigation" aria-label="Seções">
          <button className={`nav-item ${view === 'create' ? 'active' : ''}`} onClick={() => setView('create')} aria-current={view === 'create' ? 'page' : undefined}>
            <WandSparkles size={19} strokeWidth={1.8} /><span>Criar</span>
          </button>
          <button className={`nav-item ${view === 'library' ? 'active' : ''}`} onClick={() => setView('library')} aria-current={view === 'library' ? 'page' : undefined}>
            <Images size={19} strokeWidth={1.8} /><span>Biblioteca</span>{jobs.length > 0 && <small>{jobs.length}</small>}
          </button>
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="note-icon"><Sparkles size={18} /></span>
          <strong>Um estúdio para as suas ideias.</strong>
          <p>Da primeira descrição ao quadro em movimento.</p>
        </div>
        <div className="connection-mini"><span className={`status-light ${provider?.configured ? 'connected' : ''}`} /><span>{connectionError ? 'Servidor indisponível' : provider?.configured ? 'Chave carregada' : 'API não configurada'}</span></div>
      </div>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <div className="mobile-brand"><span className="mobile-mark">m</span><span>movix<span>studio</span></span></div>
        <div className="breadcrumbs">Estúdio <span>/</span> <strong>{view === 'create' ? 'Criar' : 'Biblioteca'}</strong></div>
        <div className="topbar-right"><span className="local-label">Seu espaço criativo</span><span className="profile-dot">M</span></div>
      </header>

      <main className="main-content">
        {view === 'create' ? <>
          <div className="intro-row">
            <div><p className="intro-kicker">Imagem &amp; movimento</p><h1>Crie o próximo<br />quadro.</h1><p className="intro-copy">Uma ideia, algumas palavras e um novo ponto de vista. Comece por uma imagem ou dê movimento a uma cena.</p></div>
            <div className="intro-aside"><span className="intro-aside-line" /><span>Seu processo começa aqui.</span></div>
          </div>

          {provider?.authRequired && <section className="access-panel" aria-label="Acesso ao estúdio">
            <div><strong>{accessReady ? 'Acesso confirmado' : 'Acesso protegido'}</strong><p>{accessReady ? 'As criações deste navegador ficam salvas somente aqui.' : 'Informe o código privado do estúdio para usar a API sem expor a chave Higgsfield.'}</p></div>
            {accessReady ? <button type="button" onClick={() => { api.clearAccessToken(); setAccessReady(false); setNotice('Acesso encerrado neste navegador.') }}>Encerrar acesso</button>
              : <form onSubmit={(event) => { event.preventDefault(); void connectAccess() }}><label htmlFor="studio-access">Código de acesso</label><input id="studio-access" type="password" autoComplete="off" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} /><button type="submit">Entrar</button>{accessError && <span role="alert">{accessError}</span>}</form>}
          </section>}

          <div className="creation-grid">
            <section className="composer" aria-labelledby="composer-title">
              <div className="composer-heading"><div><span className="section-icon"><Plus size={18} strokeWidth={2} /></span><h2 id="composer-title">Nova criação</h2></div></div>
              <div className="mode-switch" role="group" aria-label="Tipo de criação">
                <button type="button" className={mode === 'image' ? 'selected' : ''} onClick={() => { setMode('image'); setFormError('') }} aria-pressed={mode === 'image'}><ImageIcon size={17} />Imagem</button>
                <button type="button" className={mode === 'video' ? 'selected' : ''} onClick={() => { setMode('video'); setFormError('') }} aria-pressed={mode === 'video'}><Film size={17} />Vídeo</button>
                <button type="button" className={mode === 'animate' ? 'selected' : ''} onClick={() => { setMode('animate'); setFormError('') }} aria-pressed={mode === 'animate'}><Clapperboard size={17} />Animar</button>
              </div>

              <div className="field-block">
                <div className="field-heading"><label htmlFor="prompt">Descreva sua cena</label><span>{prompt.length} / 1500</span></div>
                <div className="prompt-wrap"><textarea id="prompt" value={prompt} maxLength={1500} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === 'image' ? 'Uma rua vazia depois da chuva, reflexos de neon, câmera analógica...' : mode === 'video' ? 'Uma cena cinematográfica ao pôr do sol, câmera em movimento suave...' : 'A câmera se aproxima lentamente enquanto o vento move a cena...'} /><span className="prompt-hint"><Sparkles size={14} /> Detalhes de luz, ambiente e câmera fazem diferença.</span></div>
              </div>

              {mode !== 'animate' && <div className="field-block ratio-block"><span className="field-label">Formato</span><div className="ratio-grid" role="group" aria-label="Formato da criação">{ratios.map((ratio) => <button key={ratio.value} className={`ratio-option ${aspectRatio === ratio.value ? 'selected' : ''}`} type="button" aria-pressed={aspectRatio === ratio.value} onClick={() => setAspectRatio(ratio.value)}><span className={`ratio-shape ${ratio.shape}`} /><span>{ratio.label}<small>{ratio.value}</small></span></button>)}</div></div>}
              {mode === 'video' && <div className="field-block seedance-settings"><p className="model-label">Modelo: Seedance 2.5 · Texto para vídeo</p><div className="video-options"><div><label htmlFor="duration">Duração (segundos)</label><input id="duration" type="number" min="4" max="30" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></div><div><label htmlFor="resolution">Resolução</label><select id="resolution" value={resolution} onChange={(event) => setResolution(event.target.value as NonNullable<Job['resolution']>)}><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option></select></div></div></div>}
              {mode === 'animate' && <div className="field-block reference-block">
                    <span className="field-label">Imagem de partida <span className="required">Obrigatória</span></span>
                    <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" id="reference-file" aria-label="Arquivo da imagem de partida" onChange={(event) => void uploadReference(event.target.files?.[0])} />
                    <button type="button" className="upload-button" onClick={() => uploadRef.current?.click()} disabled={uploading} aria-controls="reference-file">
                      {uploading ? <LoaderCircle size={20} className="spin" /> : <UploadCloud size={20} />}
                      <span>{uploading ? 'Enviando imagem...' : 'Escolher imagem do computador'}<small>JPEG, PNG ou WebP · até 20 MB</small></span>
                    </button>
                    <p className="reference-divider"><span>ou use um link público</span></p>
                    <div className="url-input"><Link2 size={18} /><input id="reference-url" type="url" inputMode="url" aria-label="URL pública da imagem de partida" value={referenceUrl} onChange={(event) => setReferenceUrl(event.target.value)} placeholder="https://.../imagem.jpg" /></div>
                    <p>O modelo DoP Turbo anima esta imagem. Para gerar vídeo somente com texto, selecione Vídeo (Seedance 2.5).</p>
                    {completedImages.length > 0 && <div className="reference-library"><span>Ou escolha da biblioteca</span><div>{completedImages.slice(0, 5).map((job) => <button key={job.id} className={referenceUrl === job.outputUrl ? 'chosen' : ''} type="button" onClick={() => setReferenceUrl(job.outputUrl!)} title={job.prompt}><img src={job.outputUrl} alt={job.prompt} /></button>)}</div></div>}
                  </div>}

              {mode !== 'video' && <details className="advanced"><summary><span>Mais opções</span><ChevronDown size={16} /></summary><div className="advanced-body"><label htmlFor="seed">Semente <span>Opcional</span></label><input id="seed" type="number" min="0" max="2147483647" step="1" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Aleatória" /><p>Use a mesma semente para repetir uma variação com parâmetros parecidos.</p></div></details>}

              {formError && <p className="form-message error" role="alert"><CircleAlert size={17} />{formError}</p>}
              {notice && !formError && <p className="form-message success" role="status"><Check size={17} />{notice}</p>}
              <button className="generate-button" onClick={generate} disabled={submitting || uploading} type="button"><span>{submitting ? 'Enviando...' : mode === 'image' ? 'Criar imagem' : mode === 'video' ? 'Criar vídeo' : 'Animar imagem'}</span>{submitting ? <LoaderCircle size={18} className="spin" /> : <ArrowUpRight size={19} />}</button>
              <p className="cost-note"><span className="cost-dot" />Cada criação usa créditos da sua conta Higgsfield.</p>
            </section>

            <section className="stage-section" aria-label="Prévia e inspirações">
              <div className="stage-heading"><div><p className="stage-subtitle">A sua tela</p><h2>{activeJob ? 'Seu quadro' : 'Imagine a cena'}</h2></div><span className="stage-heading-icon"><Clapperboard size={22} strokeWidth={1.5} /></span></div>
              <div className={`stage ${activeJob?.status === 'completed' ? 'stage-output' : ''}`}>
                {activeJob?.status === 'completed' && activeJob.outputUrl ? activeJob.mode === 'image' ? <img src={activeJob.outputUrl} alt={activeJob.prompt} className="stage-image" /> : <video src={activeJob.outputUrl} controls playsInline className="stage-image" aria-label={activeJob.prompt} /> : <img src={scene.image} alt={`Ilustração de inspiração: ${scene.title}`} className="stage-image" />}
                {(!activeJob || activeJob.status !== 'completed') && <div className="stage-shade" />}
                <div className="stage-top"><span className="stage-tag"><span />{activeJob ? statusLabels[activeJob.status] : 'Inspiração'}</span><span className="frame-corners">[ &nbsp; &nbsp; &nbsp; ]</span></div>
                {activeJob && isPending(activeJob) ? <div className="stage-center"><LoaderCircle className="spin" size={30} /><strong>Preparando seu quadro</strong><span>A criação está em andamento. Você pode continuar explorando o estúdio.</span></div> : activeJob?.status === 'failed' || activeJob?.status === 'interrupted' ? <div className="stage-center"><CircleAlert size={30} /><strong>Não foi possível concluir</strong><span>{activeJob.error}</span></div> : !activeJob ? <div className="stage-bottom"><div><span>Exemplo de composição</span><strong>{scene.title}</strong></div><span className="stage-vertical">MOVIX / STUDIO</span></div> : null}
              </div>
              <div className="stage-foot"><span><span className="tiny-square" />{activeJob?.status === 'completed' ? (activeJob.mode === 'image' ? 'Imagem criada com Higgsfield' : 'Vídeo criado com Higgsfield') : 'As imagens abaixo são ilustrações de inspiração, não resultados de IA.'}</span>{activeJob?.status === 'completed' && <button onClick={() => setSelectedJobId(activeJob.id)}>Ver detalhes <ArrowRight size={16} /></button>}</div>

              <div className="inspiration-heading"><div><h3>Um ponto de partida</h3><p>Escolha uma ideia e faça do seu jeito.</p></div><span>{String(inspirations.length).padStart(2, '0')} cenas</span></div>
              <div className="inspiration-grid">{inspirations.map((item, index) => <button type="button" key={item.title} className={`inspiration-card ${selectedInspiration === index && !activeJob ? 'selected' : ''}`} onClick={() => useInspiration(index)}><span className="inspiration-image"><img src={item.image} alt="" /><span className="inspiration-arrow"><ArrowUpRight size={16} /></span></span><strong>{item.title}</strong><small>{item.kind}</small></button>)}</div>
            </section>
          </div>

          {!provider?.configured && <section className="setup-banner" aria-labelledby="setup-title"><div className="setup-symbol"><Link2 size={22} /></div><div><h2 id="setup-title">Conecte sua API para criar</h2><p>{provider?.authRequired ? <>Configure <code>HF_CREDENTIALS</code> e <code>MOVIX_ACCESS_TOKEN</code> nas variáveis privadas do projeto Vercel e faça um novo deploy. Nunca coloque essas chaves no código do navegador.</> : <>Preencha <code>HF_CREDENTIALS</code> em <code>.env.local</code> com seu ID e segredo (key-id:key-secret) e reinicie o servidor. A chave fica apenas no servidor.</>}</p></div><a href="https://docs.higgsfield.ai/docs/how-to/sdk" target="_blank" rel="noopener noreferrer">Ver SDK oficial <ExternalLink size={16} /></a></section>}
        </> : <section className="library-page">
          <div className="library-intro"><div><button type="button" className="back-link" onClick={() => setView('create')}><ArrowLeft size={17} /> Voltar ao estúdio</button><h1>Sua biblioteca<span>.</span></h1><p>As cenas que você criou, reunidas em um só lugar neste computador.</p></div><button type="button" className="new-button" onClick={() => setView('create')}><Plus size={18} /> Nova criação</button></div>
          <div className="library-toolbar"><div className="filter-tabs" role="group" aria-label="Filtrar criações"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tudo <span>{jobs.length}</span></button><button className={filter === 'image' ? 'active' : ''} onClick={() => setFilter('image')}>Imagens</button><button className={filter === 'video' ? 'active' : ''} onClick={() => setFilter('video')}>Vídeos</button></div><span>Mais recentes primeiro</span></div>
          {visibleJobs.length === 0 ? <div className="empty-library"><span className="empty-icon"><Images size={30} strokeWidth={1.35} /></span><h2>{jobs.length ? 'Nenhuma criação deste tipo' : 'Seu primeiro quadro começa aqui'}</h2><p>{jobs.length ? 'Escolha outro filtro para ver suas criações.' : 'Depois de criar uma imagem ou vídeo, você poderá encontrá-lo nesta biblioteca.'}</p><button onClick={() => jobs.length ? setFilter('all') : setView('create')}>{jobs.length ? 'Ver tudo' : 'Criar agora'} <ArrowRight size={17} /></button></div> : <div className="library-grid">{visibleJobs.map((job) => <button type="button" className="job-card" key={job.id} onClick={() => setSelectedJobId(job.id)}><span className="job-card-visual"><JobVisual job={job} />{job.status === 'completed' && job.mode !== 'image' && <span className="play-badge"><Play size={16} fill="currentColor" /></span>}</span><span className="job-card-details"><span className="job-card-meta">{job.mode === 'image' ? <ImageIcon size={15} /> : <Film size={15} />}{job.mode === 'image' ? 'Imagem' : 'Vídeo'}<span className="meta-separator" /><Clock3 size={14} />{formatDate(job.createdAt)}</span><strong>{job.prompt}</strong><span className={`job-status ${job.status}`}>{isPending(job) && <LoaderCircle size={13} className="spin" />}{statusLabels[job.status]}</span></span></button>)}</div>}
        </section>}
      </main>
      <footer className="footer"><span>MOVIX Studio</span><span>Um espaço independente para criação. Integração com a API Higgsfield.</span></footer>
      <nav className="mobile-nav" aria-label="Navegação móvel"><button className={view === 'create' ? 'active' : ''} onClick={() => setView('create')}><WandSparkles size={20} />Criar</button><button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Images size={20} />Biblioteca</button></nav>
    </div>

    {selectedJob && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedJobId(null) }}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="modal-header"><div><span>{selectedJob.mode === 'image' ? 'Imagem' : 'Vídeo'} <span className="modal-divider">/</span> {formatDate(selectedJob.createdAt)}</span><h2 id="detail-title">Detalhes da criação</h2></div><button className="close-button" onClick={() => setSelectedJobId(null)} aria-label="Fechar detalhes">×</button></div><div className="modal-visual">{selectedJob.status === 'completed' && selectedJob.outputUrl && selectedJob.mode !== 'image' ? <video src={selectedJob.outputUrl} controls playsInline aria-label={selectedJob.prompt} /> : <JobVisual job={selectedJob} />}</div><div className="modal-content"><div className="modal-status-row"><span className={`job-status ${selectedJob.status}`}>{statusLabels[selectedJob.status]}</span><span>{selectedJob.mode === 'image' ? `${provider?.imageModel || 'Flux Pro Kontext Max'} / ${selectedJob.aspectRatio}` : selectedJob.mode === 'animate' || selectedJob.referenceUrl ? provider?.animateModel || 'DoP Turbo' : provider?.videoModel || 'Seedance 2.5'}</span></div><h3>Descrição</h3><p>{selectedJob.prompt}</p>{selectedJob.error && <p className="modal-error"><CircleAlert size={16} />{selectedJob.error}</p>}<div className="modal-actions"><button onClick={() => copyPrompt(selectedJob.prompt)}><Copy size={16} />{copySuccess ? 'Copiado' : 'Copiar descrição'}</button>{selectedJob.mode === 'image' && selectedJob.status === 'completed' && <button onClick={() => useAsReference(selectedJob)}><Film size={16} />Animar imagem</button>}{selectedJob.status === 'completed' && selectedJob.outputUrl && <a href={selectedJob.outputUrl} target="_blank" rel="noopener noreferrer">Abrir arquivo <ExternalLink size={16} /></a>}</div><button className="delete-link" onClick={() => removeJob(selectedJob)} disabled={isPending(selectedJob)}><Trash2 size={15} />Remover do histórico</button></div></section></div>}
  </div>
}

export default App
