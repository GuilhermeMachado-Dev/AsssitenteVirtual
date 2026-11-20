(() => {
  'use strict'
  
  const backdrop = document.getElementById('atmosphere')
  const hologram = document.getElementById('hologram')
  const art = hologram.parentElement
  const hero = art.closest('.hero')
  const image = art.querySelector('img')
  const background = backdrop.getContext('2d')
  const scene = hologram.getContext('2d')
  const body = document.createElement('canvas')
  const figure = body.getContext('2d')
  if (!background || !scene || !figure) return
  
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const palettes = {
    estudos: [[56,199,255], [155,232,255], [6,93,187]],
    projetos: [[47,228,154], [255,189,83], [10,119,77]],
  }
  const tau = Math.PI * 2
  const random = Math.random
  const rgba = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
  const stars = Array.from({length: 132}, () => ({
    x: random(), y: random(), depth: random(), phase: random() * tau,
    rate: .32 + random() * 1.2, sway: (random() - .5) * 25, drift: 2 + random() * 11,
  }))
  const sparks = Array.from({length: 56}, (_, i) => ({
    orbit: i % 3, phase: random() * tau, speed: .15 + random() * .37,
    offset: (random() - .5) * .13, phaseY: random() * tau,
    brightness: .16 + random() * .58, size: .55 + random() * 1.05,
  }))
  const bands = [
    {height:.14, phase:1.1, weight:1, warm:false, speed:.055, origin:.12},
    {height:.82, phase:2.9, weight:.72, warm:true, speed:-.041, origin:.88},
    {height:.48, phase:4.5, weight:.55, warm:false, speed:.035, origin:.52},
  ]
  let bgSize, heroSize, frame = 0, time = 0, previous = 0, activity = 0
  
  function resize(canvas, ctx, limit) {
    const {width, height} = canvas.getBoundingClientRect()
    const scale = Math.min(devicePixelRatio || 1, limit)
    const pixels = [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))]
    if (canvas.width !== pixels[0] || canvas.height !== pixels[1]) {
      canvas.width = pixels[0]
      canvas.height = pixels[1]
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    return {width, height, scale}
  }
  
  function bandHeight(band, u, t, h) {
    const wave = Math.sin(u * 7.8 + band.phase + t * .14) * h * .093
    const fold = Math.sin(u * 15 - t * .25 + band.phase) * h * .022
    return h * band.height + wave + fold
  }

  function backdropFrame(t, colors) {
    const {width: w, height: h} = bgSize
    background.clearRect(0, 0, w, h)
    for (const band of bands) {
      const color = colors[band.warm ? 1 : 0]
      const gradient = background.createLinearGradient(0, 0, w, 0)
      gradient.addColorStop(0, rgba(color, .21 * band.weight))
      gradient.addColorStop(.25, rgba(color, .28 * band.weight))
      gradient.addColorStop(.53, rgba(colors[2], .06))
      gradient.addColorStop(.79, rgba(color, .25 * band.weight))
      gradient.addColorStop(1, rgba(color, .12))
      background.strokeStyle = gradient
      for (let strand = 0; strand < 7; strand++) {
        background.beginPath()
        for (let point = 0; point <= 45; point++) {
          const u = point / 45
          const y = bandHeight(band, u, t, h) + (strand - 3) * (4 + 6 * Math.sin(u * 5 + t * .19) ** 2)
          if (point === 0) background.moveTo(0, y)
          else background.lineTo(u * w, y)
        }
        background.globalAlpha = strand === 3 ? 1 : .36
        background.lineWidth = strand === 3 ? 1.5 : 1
        if (strand === 3) {
          background.shadowBlur = 14
          background.shadowColor = rgba(color, .57)
        }
        background.stroke()
        background.shadowBlur = 0
      }
      background.globalAlpha = 1
      const travel = ((band.origin + t * band.speed) % 1 + 1) % 1
      const fade = Math.sin(travel * Math.PI)
      const y = bandHeight(band, travel, t, h)
      glow(background, travel * w, y, Math.min(w, h) * .12, color, .16 * fade * band.weight)
      for (let i = 1; i < 14; i++) {
        const u = travel - band.speed * i * .14
        if (u < 0 || u > 1) continue
        const x = u * w
        const tail = (1 - i / 14) * fade * band.weight
        background.fillStyle = rgba(color, .60 * tail)
        background.beginPath()
        background.arc(x, bandHeight(band, u, t, h), .55 + tail * 1.2, 0, tau)
        background.fill()
      }
    }
    background.globalAlpha = 1
    for (const star of stars) {
      const y = ((star.y * h - t * star.drift) % h + h) % h
      const x = star.x * w + Math.sin(t * star.rate * .17 + star.phase) * star.sway
      const twinkle = .5 + .5 * Math.sin(t * star.rate + star.phase)
      background.fillStyle = rgba(colors[star.phase > 4.8 ? 1 : 0], (.09 + twinkle * .36) * (.45 + star.depth * .55))
      const radius = .35 + star.depth * 1.05
      background.beginPath()
      background.arc(x, y, radius, 0, tau)
      background.fill()
    }
  }
  
  function glow(ctx, x, y, radius, color, alpha) {
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius)
    light.addColorStop(0, rgba(color, alpha))
    light.addColorStop(.26, rgba(color, alpha * .45))
    light.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = light
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  
  // Uma única amostragem contínua desloca a textura e mantém suaves as bordas dos braços.
  function createPoseRenderer() {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2', {alpha:true, premultipliedAlpha:true, depth:false, antialias:false})
    if (!gl) return null
    const program = gl.createProgram()
    function attach(type, source) {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      gl.attachShader(program, shader)
      gl.deleteShader(shader)
    }
    attach(gl.VERTEX_SHADER, `#version 300 es
      out vec2 uv;
      void main(){
        vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2);
        uv=vec2(p.x,1.-p.y);
        gl_Position=vec4(2.*p-1.,0.,1.);
      }`)
    attach(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      uniform sampler2D art;
      uniform vec2 pose;
      in vec2 uv;
      out vec4 pixel;
      void main(){
        vec2 q=uv;
        float arm=smoothstep(.39,.70,q.y)*(1.-smoothstep(.76,.85,q.y));
        float reach=abs(q.x-.5);
        arm*=smoothstep(.125,.24,reach)*(1.-smoothstep(.34,.45,reach));
        float side=q.x<.5?-1.:1.;
        float angle=q.x<.5?pose.x:pose.y;
        vec2 shoulder=vec2(.5+side*.205,.415);
        vec2 d=q-shoulder;
        float a=angle*arm;
        q=shoulder+mat2(cos(a),-sin(a),sin(a),cos(a))*d;
        pixel=texture(art,q);
      }`)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
    gl.useProgram(program)
    const pose = gl.getUniformLocation(program,'pose')
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D,texture)
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true)
    return {
      upload() {
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,body)
        gl.generateMipmap(gl.TEXTURE_2D)
      },
      draw(size, t) {
        if (canvas.width!==size || canvas.height!==size) {
          canvas.width=canvas.height=size
          gl.viewport(0,0,size,size)
        }
        const left=.051*Math.sin(t*.88)+.012*Math.sin(t*.43)
        const right=-.048*Math.sin(t*.88+.65)+.012*Math.sin(t*.47)
        gl.uniform2f(pose,left,right)
        gl.drawArrays(gl.TRIANGLES,0,3)
        return canvas
      }
    }
  }
  const poseRenderer = createPoseRenderer()
  const orbitalColors = {
    estudos: [[91,218,255],[105,157,255],[110,255,232]],
    projetos: [[96,247,177],[255,198,95],[180,248,108]],
  }
  const electronSpeeds = [1.83,-1.47,2.08]

  function drawAtom(w, mode) {
    const radius = w * .108
    const colors = orbitalColors[mode]
    const coreColor = mode === 'projetos' ? [255,203,105] : [70,230,255]
    const pulse = (.5 + .5 * Math.sin(time * 2.15)) ** 1.35
    scene.save()
    scene.translate(w * .001, -w * .315)
    glow(scene,0,0,radius*(.74+.16*pulse),coreColor,.31+.21*pulse)
    const electrons = []
    for (let i=0;i<3;i++) {
      const color=colors[i]
      const tilt=-.38+i*Math.PI/3
      const speed=electronSpeeds[i]
      const phase=time*speed+i*2.1
      const depth=Math.sin(phase)
      const minor=radius*(.31+.052*Math.sin(time*.60+i))
      scene.save()
      scene.rotate(tilt+.07*Math.sin(time*.54+i))
      scene.strokeStyle=rgba(color,.68)
      scene.lineWidth=Math.max(1,w*.0027)
      scene.beginPath()
      scene.ellipse(0,0,radius,minor,0,0,tau)
      scene.stroke()
      // O rastro acompanha o sentido de cada elétron e clareia perto dele.
      const dir=Math.sign(speed)
      scene.lineCap='round'
      for(let j=6;j>0;j--){
        scene.beginPath()
        scene.strokeStyle=rgba(color,(7-j)*.094)
        scene.lineWidth=w*.0034
        scene.ellipse(0,0,radius,minor,0,phase-dir*j*.070,phase-dir*(j-1)*.070,dir<0)
        scene.stroke()
      }
      const x=radius*Math.cos(phase),y=minor*depth
      const heading=tilt+.07*Math.sin(time*.54+i)
      electrons.push({x:x*Math.cos(heading)-y*Math.sin(heading),
        y:x*Math.sin(heading)+y*Math.cos(heading),depth,color})
      scene.restore()
    }
    function electron(p){
      const size=w*(.0058+.0011*p.depth)
      glow(scene,p.x,p.y,size*4.2,p.color,.83)
      glow(scene,p.x,p.y,size*1.55,p.color,1)
      scene.beginPath()
      scene.arc(p.x,p.y,size*.66,0,tau)
      scene.fillStyle=rgba([247,255,255],.91)
      scene.fill()
    }
    electrons.filter(p=>p.depth<0).forEach(electron)
    // O centro fica aceso durante todo o ciclo. A intensidade se concentra no halo.
    const lightRadius=radius*(.38+.08*pulse+.04*activity)
    const light=scene.createRadialGradient(0,0,0,0,0,lightRadius)
    light.addColorStop(0,'#ffffff')
    light.addColorStop(.15,rgba([250,255,255],.96))
    light.addColorStop(.34,rgba(coreColor,.78+.17*pulse))
    light.addColorStop(.65,rgba(coreColor,.25+.15*pulse))
    light.addColorStop(1,rgba(coreColor,0))
    scene.fillStyle=light
    scene.fillRect(-lightRadius,-lightRadius,2*lightRadius,2*lightRadius)
    electrons.filter(p=>p.depth>=0).forEach(electron)
    scene.restore()
  }
  let cachedMode
  function drawFigure(w, turn, lift, isProject) {
    // Colorir a arte na resolução original apenas quando a paleta muda.
    if (cachedMode !== isProject) {
      body.width = image.naturalWidth
      body.height = image.naturalHeight
      figure.filter = isProject ? 'hue-rotate(-51deg)' : 'none'
      figure.drawImage(image, 0, 0)
      poseRenderer?.upload()
      cachedMode = isProject
    }
    scene.save()
    scene.imageSmoothingEnabled = true
    scene.imageSmoothingQuality = 'high'
    scene.translate(w * .5, w * .87)
    scene.transform(1 - .006 * turn * turn, .004 * turn, -.014 * turn, 1 - lift / w, 0, 0)
    const posed=poseRenderer?.draw(Math.max(1,Math.round(w*heroSize.scale)),time) || body
    scene.drawImage(posed, -w * .5, -w * .87, w, w)
    drawAtom(w,isProject?'projetos':'estudos')
    scene.restore()
  }
  function orbitAt(index, a, w, lift, offset = 0) {
    const rotation = [ -.40, .44, -.08 ][index]
    const u = Math.cos(a) * w * (.42 + offset)
    const v = Math.sin(a) * w * ([.105,.122,.037][index] + offset * .35)
    return [
      w * .5 + u * Math.cos(rotation) - v * Math.sin(rotation),
      w * [ .47,.52,.87 ][index] + lift * (index === 2 ? .12 : .7) + u * Math.sin(rotation) + v * Math.cos(rotation),
    ]
  }
  
  function orbits(w, t, lift, pulse, colors, front) {
    for (let i = 0; i < 3; i++) {
      const color = colors[i % 2]
      const phase = (i * 2.07 + t * (.72 + .19 * i)) % tau
      scene.strokeStyle = rgba(color, front ? .32 + pulse * .20 : .18)
      scene.lineWidth = i === 2 ? .9 : 1.15
      scene.beginPath()
      for (let step = 0; step <= 32; step++) {
        const a = (front ? 0 : Math.PI) + step / 32 * Math.PI
        const [x, y] = orbitAt(i, a, w, lift)
        if (step === 0) scene.moveTo(x, y)
        else scene.lineTo(x, y)
      }
      scene.stroke()
      // Cada trecho atravessa a frente e o verso independentemente da cabeça do rastro.
      scene.lineCap = 'round'
      for (let j = 24; j > 0; j--) {
        const a = phase - j * .018
        const end = a + .018
        for (const shift of [-tau, 0]) {
          const startAngle = Math.max(a, shift + (front ? 0 : Math.PI))
          const endAngle = Math.min(end, shift + (front ? Math.PI : tau))
          if (endAngle <= startAngle) continue
          const intensity = 1 - (j - .5) / 24
          scene.strokeStyle = rgba(color, intensity * (.55 + .23 * Math.sin(a)))
          scene.lineWidth = .55 + intensity * w * .005
          scene.beginPath()
          scene.moveTo(...orbitAt(i, startAngle, w, lift))
          scene.lineTo(...orbitAt(i, endAngle, w, lift))
          scene.stroke()
        }
      }
      if ((phase < Math.PI) !== front) continue
      const [x, y] = orbitAt(i, phase, w, lift)
      glow(scene, x, y, w * (.046 + pulse * .014), color, .74 + .20 * Math.sin(phase))
      scene.fillStyle = rgba(colors[1], .9)
      scene.beginPath()
      scene.arc(x, y, Math.max(1.2, w * .004), 0, tau)
      scene.fill()
    }
    for (const spark of sparks) {
      const a = spark.phase + t * spark.speed
      if ((Math.sin(a) > 0) !== front) continue
      const [x, baseY] = orbitAt(spark.orbit, a, w, lift, spark.offset)
      const y = baseY + Math.sin(t * spark.speed * 3 + spark.phaseY) * w * .027
      const flicker = .62 + .38 * Math.sin(a * 3 + spark.phaseY)
      scene.fillStyle = rgba(colors[spark.orbit % 2], spark.brightness * flicker * (.86 + .14 * Math.sin(a)))
      scene.beginPath()
      scene.arc(x, y, spark.size * Math.min(1.2, w / 410), 0, tau)
      scene.fill()
    }
  }
  
  function render() {
    if (!bgSize || !heroSize) return
    const mode = document.documentElement.dataset.mode
    const colors = palettes[mode] || palettes.estudos
    backdropFrame(time, colors)
    const w = heroSize.width
    scene.clearRect(0, 0, w, heroSize.height)
    if (!image.naturalWidth || w < 1) return
    art.classList.add('is-animated')
    const turn = Math.sin(time * .65)
    const breath = .5 + .5 * Math.sin(time * 1.52 - .5)
    const pulse = Math.min(1, .22 + breath * .28 + activity * .54)
    const lift = -w * (.009 * breath + .005 * activity)
    orbits(w, time, lift, pulse, colors, false)
    drawFigure(w, turn, lift, mode === 'projetos')
    scene.globalCompositeOperation = 'screen'
    glow(scene, w * .5, w * .873, w * (.072 + pulse * .026), colors[0], .15 + pulse * .20)
    orbits(w, time, lift, pulse, colors, true)
    scene.globalCompositeOperation = 'source-over'
  }
  
  function tick(now) {
    frame = 0
    if (document.hidden || motion.matches) return
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 0
    previous = now
    const target = hero.classList.contains('speaking') ? 1 : 0
    activity += (target - activity) * (1 - Math.exp(-dt * (target ? 8 : 3)))
    time += dt * (1 + activity * .40)
    render()
    frame = requestAnimationFrame(tick)
  }
  
  function sync() {
    cancelAnimationFrame(frame)
    frame = 0
    previous = 0
    if (document.hidden) return
    if (motion.matches) {
      time = 0
      activity = 0
      render()
    } else {
      render()
      frame = requestAnimationFrame(tick)
    }
  }
  
  const sizes = new ResizeObserver(() => {
    bgSize = resize(backdrop, background, 1.25)
    heroSize = resize(hologram, scene, 2.5)
    if (!frame) render()
  })
  sizes.observe(backdrop)
  sizes.observe(hologram)
  new MutationObserver(() => { if (!frame) render() }).observe(document.documentElement, {
    attributes:true, attributeFilter:['data-mode'],
  })
  image.addEventListener('load', render)
  document.addEventListener('visibilitychange', sync)
  motion.addEventListener('change', sync)
  sync()
})()



