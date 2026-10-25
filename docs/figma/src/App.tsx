import { useState } from 'react'

type Screen = 'landing' | 'auth' | 'desk' | 'file' | 'learn' | 'placement' | 'review' | 'components'
type IconName = 'desk' | 'learn' | 'settings' | 'file' | 'audio' | 'upload' | 'check' | 'play' | 'reset' | 'arrow' | 'book' | 'search' | 'road' | 'layers' | 'moon' | 'alert'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    desk: <><path d="M3 9h18M5 9v11m14-11v11M8 5h8v4"/></>,
    learn: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5a3.5 3.5 0 0 1 3.5 3V5.5Z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.8 2.8-.06-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.08A1.8 1.8 0 0 0 8.7 19.3a1.8 1.8 0 0 0-2 .36l-.06.05-2.8-2.8.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.6 13.8H2v-4h.08A1.8 1.8 0 0 0 3.7 8.7a1.8 1.8 0 0 0-.36-2l-.05-.06 2.8-2.8.06.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.2 2.6V2h4v.08a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.36l.06-.05 2.8 2.8-.05.06a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.65 1.1H22v4h-.08A1.8 1.8 0 0 0 19.4 15Z"/></>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h4M9 13h6m-6 4h4"/></>,
    audio: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    upload: <><path d="M12 16V3m0 0L7 8m5-5 5 5M4 15v6h16v-6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    play: <path d="m9 6 9 6-9 6z"/>,
    reset: <><path d="M4 4v6h6"/><path d="M5.6 15a7 7 0 1 0 .5-7.5L4 10"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>,
    book: <><path d="M4 4h7v16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm16 0h-7v16h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    road: <><path d="M7 22 10 2m7 20L14 2M9 15h6M10 8h4"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    moon: <path d="M20 16.5A8.5 8.5 0 0 1 7.5 4 8.5 8.5 0 1 0 20 16.5Z"/>,
    alert: <><path d="M12 3 2 21h20z"/><path d="M12 9v5m0 3v.1"/></>,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>
}

function Button({ children, variant = 'primary', onClick, icon }: { children: React.ReactNode; variant?: string; onClick?: () => void; icon?: IconName }) {
  return <button className={`button ${variant}`} onClick={onClick}>{icon && <Icon name={icon} size={16}/>} {children}</button>
}

function Shell({ children, screen, setScreen }: { children: React.ReactNode; screen: Screen; setScreen: (s: Screen) => void }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <button className="mini-brand" onClick={() => setScreen('landing')}>SD<span>.</span></button>
      <nav>
        <button className={screen === 'desk' || screen === 'file' ? 'active' : ''} onClick={() => setScreen('desk')}><Icon name="desk"/><span>Desk</span></button>
        <button className={['learn','placement','review'].includes(screen) ? 'active' : ''} onClick={() => setScreen('learn')}><Icon name="learn"/><span>Learn</span></button>
        <button onClick={() => setScreen('components')}><Icon name="settings"/><span>Settings</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="avatar">A</div><span>Akari</span></div>
    </aside>
    <main className="workspace">{children}</main>
  </div>
}

function Landing({ go }: { go: (s: Screen) => void }) {
  return <div className="landing">
    <header className="landing-nav"><div className="wordmark small">Study Desk<span>.</span></div><div><button className="text-button" onClick={() => go('auth')}>Sign in</button><Button onClick={() => go('desk')}>Start free</Button></div></header>
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">A calm place for serious study</p>
        <h1 className="wordmark">Study<br/>Desk<span>.</span></h1>
        <h2>One desk. Clear paths.<br/>Language study that stays with you.</h2>
        <p>Keep files, tasks, focus sessions, and language practice together—from your first Japanese review to every path ahead.</p>
        <div className="actions"><Button onClick={() => go('desk')}>Start free <Icon name="arrow"/></Button><Button variant="secondary" onClick={() => go('auth')}>Sign in</Button></div>
      </div>
      <div className="hero-image" role="img" aria-label="A quiet study desk with a notebook and plant">
        <div className="image-note"><span>今日の焦点</span><strong>Small steps,<br/>kept daily.</strong><div className="rule"/></div>
        <div className="photo-credit">Photo by Chris Vasquez · Unsplash</div>
      </div>
    </section>
    <footer>Unofficial practice — not affiliated with JLPT/IELTS</footer>
  </div>
}

function Auth({ go }: { go: (s: Screen) => void }) {
  const [signup, setSignup] = useState(false)
  const [error, setError] = useState(false)
  return <div className="auth-page">
    <button className="wordmark small auth-brand" onClick={() => go('landing')}>Study Desk<span>.</span></button>
    <div className="auth-panel">
      <p className="eyebrow">Welcome to your desk</p>
      <h1>{signup ? 'Create your account' : 'Sign in'}</h1>
      <p>{signup ? 'Start with one desk and one language path.' : 'Continue where you left off.'}</p>
      {error && <div className="error-box"><Icon name="alert"/><span>We couldn’t sign you in. Check your email and password.</span></div>}
      <label>Email<input type="email" placeholder="you@example.com"/></label>
      <label>Password<input type="password" placeholder="8+ characters"/></label>
      <Button onClick={() => error ? go('desk') : setError(true)}>{signup ? 'Create account' : 'Sign in'}</Button>
      <p className="switch">{signup ? 'Already have an account?' : 'New to Study Desk?'} <button onClick={() => { setSignup(!signup); setError(false) }}>{signup ? 'Sign in' : 'Create one'}</button></p>
    </div>
  </div>
}

const files = [
  { name: 'Genki II — Chapter 14', meta: 'PDF · 12.4 MB · Today', type: 'file' as IconName, tag: 'Japanese' },
  { name: 'Listening drill — week 4', meta: 'MP3 · 18 min · Yesterday', type: 'audio' as IconName, tag: 'Listening' },
  { name: 'Grammar notes', meta: 'PDF · 2.1 MB · May 18', type: 'file' as IconName, tag: 'N4' },
]

function FileRow({ file, onClick }: { file: typeof files[0]; onClick?: () => void }) {
  return <button className="file-row" onClick={onClick}><span className={`file-icon ${file.type}`}><Icon name={file.type}/></span><span className="file-info"><strong>{file.name}</strong><small>{file.meta}</small></span><span className="chip">{file.tag}</span><Icon name="arrow" size={16}/></button>
}

function Desk({ go }: { go: (s: Screen) => void }) {
  const [done, setDone] = useState([false, true, false])
  const [timer, setTimer] = useState(false)
  return <div className="page">
    <div className="page-head"><div><p className="eyebrow">Tuesday, 21 May</p><h1>Good afternoon, Akari.</h1><p>Everything you need, within reach.</p></div><div className="quota">Free plan<br/><strong>1 desk · storage limited</strong></div></div>
    <div className="desk-grid">
      <section className="files-section">
        <div className="section-head"><div><h2>Files</h2><span>3 of 20</span></div><Button variant="secondary" icon="upload">Upload PDF or MP3</Button></div>
        <div className="drop-zone"><Icon name="upload"/><span>Drop study files here</span><small>PDF + MP3 only</small></div>
        <div className="file-list">{files.map((f, i) => <FileRow key={f.name} file={f} onClick={i === 0 ? () => go('file') : undefined}/>)}</div>
        <div className="state-strip"><span><i className="skeleton"/>Loading files…</span><span><Icon name="alert" size={14}/> Upload failed · <button>Try again</button></span><span>No files yet · Add your first PDF</span></div>
      </section>
      <div className="right-stack">
        <section><div className="section-head"><h2>Tasks</h2><button className="text-button">+ Add</button></div>
          <div className="task-list">{['Review chapter 14','Complete 20 reviews','Listen: week 4 drill'].map((t,i) => <label className="task-row" key={t}><input type="checkbox" checked={done[i]} onChange={() => setDone(done.map((v,j) => j === i ? !v : v))}/><span><strong>{t}</strong><small>{i === 0 ? 'Today, 7:00 PM' : i === 1 ? 'Today' : 'Tomorrow'}</small></span></label>)}</div>
        </section>
        <section className="focus"><div className="section-head"><h2>Focus</h2><span>Pomodoro</span></div><div className="timer"><strong>{timer ? '24:32' : '25:00'}</strong><small>{timer ? 'Focus in progress' : 'Ready when you are'}</small></div><div className="timer-actions"><Button icon="play" onClick={() => setTimer(!timer)}>{timer ? 'Pause' : 'Start'}</Button><Button variant="ghost" icon="reset">Reset</Button></div></section>
        <section><div className="section-head"><h2>Desk theme</h2></div><div className="themes"><button className="theme active"><i/>Paper</button><button className="theme moss"><i/>Moss</button><button className="theme night"><i/>Midnight-light</button></div></section>
      </div>
    </div>
  </div>
}

function FileDetail({ go }: { go: (s: Screen) => void }) {
  const [tab, setTab] = useState<'pdf'|'audio'>('pdf')
  return <div className="page file-page">
    <button className="back" onClick={() => go('desk')}>← Back to desk</button>
    <div className="page-head compact"><div><h1>{tab === 'pdf' ? 'Genki II — Chapter 14' : 'Listening drill — week 4'}</h1><div><span className="chip">Japanese</span> <span className="chip">N4</span></div></div><div className="segmented"><button className={tab === 'pdf' ? 'active' : ''} onClick={() => setTab('pdf')}>PDF</button><button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}>MP3</button></div></div>
    {tab === 'pdf' ? <div className="viewer"><div className="viewer-bar"><span>Page 42 of 176</span><div>− &nbsp; 100% &nbsp; +</div></div><div className="paper"><small>第十四課</small><h2>バレンタインデー</h2><p className="jp">日本では、バレンタインデーに女の人が男の人にチョコレートをあげます。</p><div className="paper-rule"/><h3>Grammar note</h3><p>Use あげる when the giver is the speaker or someone in the speaker’s in-group.</p></div></div> :
    <div className="audio-player"><div className="record"><div/><Icon name="audio" size={34}/></div><p className="eyebrow">Listening practice · 18:04</p><h2>Week 4 — Everyday conversations</h2><div className="waveform">{Array.from({length: 50}).map((_,i)=><i key={i} style={{height: `${10 + (i*13)%34}px`}}/>)}</div><div className="player-controls"><span>03:12</span><button><Icon name="play" size={24}/></button><span>18:04</span></div></div>}
  </div>
}

function Learn({ go }: { go: (s: Screen) => void }) {
  const actions: [string,string,IconName,Screen][] = [['Placement','Check your approximate level','layers','placement'],['Roadmap','See what comes next','road','learn'],['Reviews','12 cards due today','book','review'],['Dictionary','Search words and readings','search','learn']]
  return <div className="page learn-page"><div className="page-head"><div><p className="eyebrow">Learn</p><h1>Your language path</h1><p>Steady progress, without the noise.</p></div><div className="quota">Free plan<br/><strong>1 active path on Free</strong></div></div>
    <section className="active-path"><div><span className="language-mark">日</span><p className="eyebrow">Active path · Japanese</p><h2>Approx. N4 path</h2><p>Keep building everyday grammar, vocabulary, and listening confidence.</p><small>Unofficial estimate · 34% complete</small></div><div className="path-progress"><strong>34%</strong><span><i/></span><small>12 reviews due</small></div></section>
    <div className="action-grid">{actions.map(([name,desc,icon,target]) => <button key={name} onClick={() => go(target)}><Icon name={icon}/><span><strong>{name}</strong><small>{desc}</small></span><Icon name="arrow"/></button>)}</div>
    <section className="coming"><span className="language-mark muted">EN</span><div><p className="eyebrow">English path</p><h3>Coming soon</h3><p>Placement, guided practice, and IELTS-oriented skills are in preparation.</p></div><button disabled>Notify me</button></section>
  </div>
}

function Placement({ go }: { go: (s: Screen) => void }) {
  const [selected, setSelected] = useState<number>()
  return <div className="page narrow"><button className="back" onClick={() => go('learn')}>← Leave placement</button><div className="test-head"><div><p className="eyebrow">Japanese placement</p><h1>Choose the best answer.</h1></div><strong>3 <span>/ 20</span></strong></div><div className="progress"><i/></div>
    <section className="question"><span className="question-label">Question 03 · Grammar</span><p className="jp large">きのう、友だちと映画を＿＿。</p><p className="translation">Yesterday, I ___ a movie with my friend.</p><div className="choices">{['見ます','見ました','見ません','見て'].map((a,i)=><button key={a} className={selected === i ? 'selected' : ''} onClick={() => setSelected(i)}><span>{String.fromCharCode(65+i)}</span>{a}</button>)}</div><div className="question-foot"><p>Results show an approximate band only. This is not a certified assessment.</p><Button variant={selected === undefined ? 'disabled' : 'primary'}>Next question <Icon name="arrow"/></Button></div></section>
  </div>
}

function Review({ go }: { go: (s: Screen) => void }) {
  const [flipped, setFlipped] = useState(false)
  const [remaining, setRemaining] = useState(12)
  return <div className="page narrow review-page"><button className="back" onClick={() => go('learn')}>← Back to learn</button><div className="review-head"><div><p className="eyebrow">Daily review</p><h1>12 remaining</h1></div><div className="daily-cap"><span><i/></span><small>8 of 20 daily Free reviews used</small></div></div>
    <button className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}><span className="card-counter">{13-remaining} / 20</span>{flipped ? <><p className="eyebrow">Reading</p><div className="reading">まなぶ</div><h2>to learn; to study</h2><p className="example">日本語を学んでいます。<br/><small>I am studying Japanese.</small></p></> : <><p className="eyebrow">Japanese · Vocabulary</p><div className="kanji">学ぶ</div><span className="tap">Tap to reveal reading and meaning</span></>}</button>
    <div className="ratings">{['Again','Hard','Good','Easy'].map((x,i)=><button key={x} className={i===0?'again':''} onClick={() => {setRemaining(Math.max(0,remaining-1));setFlipped(false)}}><strong>{x}</strong><small>{['1 min','6 min','1 day','4 days'][i]}</small></button>)}</div>
    <div className="review-states"><span><i className="skeleton"/>Loading next card…</span><span><Icon name="alert" size={14}/> Couldn’t save progress. <button>Retry</button></span><span>You’re all caught up for today.</span></div>
  </div>
}

function Components() {
  return <div className="page components-page"><div className="page-head"><div><p className="eyebrow">Study Desk system</p><h1>Components & tokens</h1><p>Reusable foundations · 8pt spacing grid</p></div></div>
    <div className="component-grid">
      <section><h2>Buttons</h2><div className="component-row"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button></div></section>
      <section><h2>Inputs & controls</h2><label>Email<input placeholder="student@example.com"/></label><div className="component-row"><label className="check-label"><input type="checkbox"/>Unchecked</label><label className="check-label"><input type="checkbox" defaultChecked/>Checked</label><span className="chip">Japanese</span><span className="chip">N4</span></div></section>
      <section><h2>Rows</h2><FileRow file={files[0]}/><label className="task-row sample"><input type="checkbox"/><span><strong>Review chapter 14</strong><small>Today, 7:00 PM</small></span></label></section>
      <section className="tokens"><h2>Tokens · export ready</h2><div className="swatches"><span><i className="bg"/>--bg<br/><small>#F4F1E9 · 244 241 233</small></span><span><i className="ink"/>--ink<br/><small>#17262B · 23 38 43</small></span><span><i className="accent"/>--accent<br/><small>#245B69 · 36 91 105</small></span><span><i className="muted"/>--muted<br/><small>#6F7B7B · 111 123 123</small></span><span><i className="success"/>--success<br/><small>#56725A · 86 114 90</small></span><span><i className="danger"/>--danger<br/><small>#A14E43 · 161 78 67</small></span></div><h3>Desk presets</h3><div className="preset-names">Paper · Moss · Midnight-light</div></section>
    </div>
  </div>
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  if (screen === 'landing') return <Landing go={setScreen}/>
  if (screen === 'auth') return <Auth go={setScreen}/>
  const content = screen === 'desk' ? <Desk go={setScreen}/> : screen === 'file' ? <FileDetail go={setScreen}/> : screen === 'learn' ? <Learn go={setScreen}/> : screen === 'placement' ? <Placement go={setScreen}/> : screen === 'review' ? <Review go={setScreen}/> : <Components/>
  return <Shell screen={screen} setScreen={setScreen}>{content}</Shell>
}
