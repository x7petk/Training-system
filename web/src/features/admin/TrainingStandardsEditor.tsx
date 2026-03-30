import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Extension, getMarkRange } from '@tiptap/core'
import { Rnd } from 'react-rnd'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Plus,
  Redo2,
  Link2,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  standardPageOuterClass,
  standardPageProseClass,
  standardPageStageClass,
  standardPageTitleClass,
} from '../training/standardPageCanvas'
import {
  escapeHrefAttr,
  escapeHtmlForLinkBody,
  normalizeTrainingLinkHref,
  sanitizeStandardContentAnchors,
  stripAnchorsForCanvasPreview,
} from '../training/trainingLinkUtils'

const IMG_BUCKET = 'skill-training-standard-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

type StandardImage = {
  id: string
  path: string
  x: number
  y: number
  w: number
  h: number
}

type StandardPage = {
  id: string
  contentHtml: string
  images: StandardImage[]
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyPage(): StandardPage {
  return { id: uid(), contentHtml: '<p></p>', images: [] }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize?.replace('px', '') || null,
            renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size:${attrs.fontSize}px` } : {}),
          },
        },
      },
    ]
  },
})

export function TrainingStandardsEditor(props: { skillId: string; skillName: string }) {
  const { skillId, skillName } = props
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [pages, setPages] = useState<StandardPage[]>([emptyPage()])
  const [activePage, setActivePage] = useState(0)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [fontSizeValue, setFontSizeValue] = useState('14')
  const [linkUrlInput, setLinkUrlInput] = useState('')
  const [linkLabelInput, setLinkLabelInput] = useState('')
  const [linkPanelFocused, setLinkPanelFocused] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 700, height: 500 })
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const page = pages[activePage] ?? pages[0]
  const imagePathsKey = useMemo(
    () => pages.flatMap((p) => p.images.map((img) => img.path)).sort().join('|'),
    [pages],
  )

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          class: 'training-standard-link',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      TextStyle,
      FontSize,
      Color,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: page?.contentHtml || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'min-h-[16rem] prose prose-sm max-w-none rounded-md border border-border bg-white px-3 py-2 focus:outline-none [&_a]:font-medium [&_a]:text-sky-700 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-sky-500/45',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      setPages((prev) =>
        prev.map((p, i) => {
          if (i !== activePage) return p
          return { ...p, contentHtml: html }
        }),
      )
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(page?.contentHtml || '<p></p>')
  }, [editor, activePage, page?.contentHtml])

  useEffect(() => {
    if (!editor) return
    const syncSize = () => {
      const attr = editor.getAttributes('textStyle')?.fontSize as string | undefined
      const normalized = attr?.replace('px', '') || '14'
      setFontSizeValue(normalized)
    }
    syncSize()
    editor.on('selectionUpdate', syncSize)
    editor.on('update', syncSize)
    return () => {
      editor.off('selectionUpdate', syncSize)
      editor.off('update', syncSize)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || linkPanelFocused) return
    const linkMark = editor.schema.marks.link
    if (!linkMark) return
    const sync = () => {
      const range = getMarkRange(editor.state.selection.$from, linkMark)
      if (range) {
        setLinkLabelInput(editor.state.doc.textBetween(range.from, range.to))
        const href = editor.getAttributes('link').href as string | undefined
        setLinkUrlInput(typeof href === 'string' ? href : '')
      } else {
        const { from, to } = editor.state.selection
        if (from !== to) {
          setLinkLabelInput(editor.state.doc.textBetween(from, to, ''))
        }
      }
    }
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    sync()
    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
    }
  }, [editor, linkPanelFocused, activePage])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      setInfo(null)
      const { data, error: e } = await supabase
        .from('skill_training_standards')
        .select('title, pages')
        .eq('skill_id', skillId)
        .maybeSingle()
      if (cancelled) return
      setLoading(false)
      if (e) {
        setError(e.message)
        setTitle('')
        setPages([emptyPage()])
        return
      }
      const d = data as { title: string; pages: unknown } | null
      setTitle(d?.title ?? '')
      const loaded = Array.isArray(d?.pages) ? (d?.pages as StandardPage[]) : []
      setPages(loaded.length > 0 ? loaded.slice(0, 5) : [emptyPage()])
      setActivePage(0)
    })()
    return () => {
      cancelled = true
    }
  }, [skillId])

  useEffect(() => {
    const paths = pages.flatMap((p) => p.images.map((img) => img.path))
    let cancelled = false
    void (async () => {
      if (paths.length === 0) {
        if (!cancelled) setImageUrls({})
        return
      }
      const next: Record<string, string> = {}
      await Promise.all(
        paths.map(async (p) => {
          const { data } = await supabase.storage.from(IMG_BUCKET).createSignedUrl(p, 60 * 30)
          if (data?.signedUrl) next[p] = data.signedUrl
        }),
      )
      if (!cancelled) setImageUrls(next)
    })()
    return () => {
      cancelled = true
    }
  }, [imagePathsKey, pages])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const measure = () => {
      setCanvasSize({
        width: Math.max(320, el.clientWidth),
        height: Math.max(320, el.clientHeight),
      })
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  async function uploadImage(file: File): Promise<string | null> {
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image is too large. Max size is 10MB.')
      return null
    }
    const ext = file.name.split('.').pop() || 'png'
    const path = `${skillId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error: e } = await supabase.storage.from(IMG_BUCKET).upload(path, file, {
      upsert: false,
      cacheControl: '3600',
    })
    if (e || !data?.path) {
      setError(e?.message ?? 'Could not upload image.')
      return null
    }
    return data.path
  }

  async function addImage(file: File) {
    const path = await uploadImage(file)
    if (!path) return
    setPages((prev) =>
      prev.map((p, i) => {
        if (i !== activePage) return p
        return {
          ...p,
          images: [...p.images, { id: uid(), path, x: 68, y: 8, w: 24, h: 24 }],
        }
      }),
    )
  }

  async function onPasteImage(e: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(e.clipboardData.items).find((x) => x.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    const file = item.getAsFile()
    if (!file) return
    await addImage(file)
  }

  async function onDropImage(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file) return
    await addImage(file)
  }

  function movePage(delta: -1 | 1) {
    const next = activePage + delta
    if (next < 0 || next >= pages.length) return
    const copy = [...pages]
    const [item] = copy.splice(activePage, 1)
    copy.splice(next, 0, item)
    setPages(copy)
    setActivePage(next)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setInfo(null)
    const payload = pages.slice(0, 5).map((p) => ({
      id: p.id,
      contentHtml: sanitizeStandardContentAnchors(p.contentHtml || '<p></p>'),
      images: p.images,
    }))
    const { error: e } = await supabase.from('skill_training_standards').upsert({
      skill_id: skillId,
      title: title.trim(),
      pages: payload,
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    setSaving(false)
    if (e) {
      setError(e.message)
      return
    }
    setInfo('Standard pages saved.')
  }

  const toolbarBtn =
    'rounded border border-border bg-surface px-2 py-1 text-xs text-fg hover:bg-black/[0.04]'

  const linkInputClass =
    'min-w-0 flex-1 rounded-lg border border-border bg-canvas/60 px-2.5 py-1.5 text-sm text-fg outline-none placeholder:text-muted focus:border-accent/40 focus:ring-2 focus:ring-accent/25'

  function applyEditorLink() {
    if (!editor) return
    const href = normalizeTrainingLinkHref(linkUrlInput)
    if (!href) {
      setError('Enter a URL (https://…, mailto:, tel:, or /path).')
      return
    }
    const labelRaw = linkLabelInput.trim()
    if (!labelRaw) {
      setError('Enter the label (visible text) for this link.')
      return
    }
    setError(null)
    const html = `<a href="${escapeHrefAttr(href)}">${escapeHtmlForLinkBody(labelRaw)}</a>`
    const chain = editor.chain().focus()
    if (editor.isActive('link')) {
      chain.extendMarkRange('link').deleteSelection().insertContent(html).run()
    } else {
      chain.deleteSelection().insertContent(html).run()
    }
  }

  function clearEditorLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    setLinkUrlInput('')
    setLinkLabelInput('')
    setError(null)
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-fg">Standards editor (WYSIWYG)</p>
      </div>
      {loading ? <p className="text-xs text-muted">Loading standards…</p> : null}
      {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
      {info ? <p className="mb-2 text-xs text-emerald-700">{info}</p> : null}

      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Main title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`${skillName} standard`}
        className="mb-3 w-full rounded-lg border border-border bg-canvas/60 px-3 py-2 text-sm"
      />

      <div className="mb-3 rounded-lg border border-border/70 bg-canvas/40 p-2">
        <p className="mb-2 text-[11px] text-muted">Page tabs and order</p>
        <div className="flex flex-wrap items-center gap-2">
          {pages.map((_, i) => (
            <button
              key={`pg-${i}`}
              type="button"
              onClick={() => setActivePage(i)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${i === activePage ? 'border-accent bg-accent/10 text-fg' : 'border-border text-muted'}`}
            >
              Page {i + 1}
            </button>
          ))}
          {pages.length < 5 ? (
            <button
              type="button"
              onClick={() => {
                setPages((prev) => [...prev, emptyPage()])
                setActivePage(pages.length)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted"
            >
              <Plus className="size-3.5" /> Add page
            </button>
          ) : null}
          <button type="button" onClick={() => movePage(-1)} className={toolbarBtn}>
            <ArrowUp className="size-3.5" />
          </button>
          <button type="button" onClick={() => movePage(1)} className={toolbarBtn}>
            <ArrowDown className="size-3.5" />
          </button>
          {pages.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                setPages((prev) => prev.filter((_, i) => i !== activePage))
                setActivePage((p) => Math.max(0, p - 1))
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-danger/40 px-2.5 py-1 text-xs text-danger"
            >
              <Trash2 className="size-3.5" /> Remove page
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-border/70 p-2.5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Editor</p>

          {editor ? (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Bold className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Italic className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                <UnderlineIcon className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                <List className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                <ListOrdered className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
                <AlignLeft className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
                <AlignCenter className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
                <AlignRight className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().toggleHighlight().run()}>
                <Highlighter className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().undo().run()}>
                <Undo2 className="size-3.5" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => editor.chain().focus().redo().run()}>
                <Redo2 className="size-3.5" />
              </button>
              <select
                value={fontSizeValue}
                onChange={(e) => {
                  setFontSizeValue(e.target.value)
                  editor.chain().focus().setMark('textStyle', { fontSize: `${e.target.value}px` }).run()
                }}
                className="rounded border border-border bg-surface px-2 py-1 text-xs"
              >
                <option value="12">12</option>
                <option value="14">14</option>
                <option value="16">16</option>
                <option value="18">18</option>
                <option value="22">22</option>
                <option value="28">28</option>
              </select>
              <input
                type="color"
                title="Text color"
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                className="h-7 w-8 rounded border border-border bg-surface p-0.5"
              />
              <select
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (n === 0) editor.chain().focus().setParagraph().run()
                  else editor.chain().focus().toggleHeading({ level: n as 1 | 2 | 3 }).run()
                }}
                className="rounded border border-border bg-surface px-2 py-1 text-xs"
              >
                <option value={0}>Paragraph</option>
                <option value={1}>Heading 1</option>
                <option value={2}>Heading 2</option>
                <option value={3}>Heading 3</option>
              </select>
            </div>
          ) : null}

          <EditorContent editor={editor} />
        </div>

        <div
          onPaste={(e) => void onPasteImage(e)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => void onDropImage(e)}
          className="rounded-lg border border-border/70 p-2.5"
        >
          {editor ? (
            <div
              className="mb-3 rounded-lg border border-border/70 bg-canvas/40 p-2.5"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setLinkPanelFocused(false)
              }}
              onFocusCapture={() => setLinkPanelFocused(true)}
            >
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
                <Link2 className="mr-1 inline size-3.5 align-[-0.125em] opacity-70" aria-hidden />
                Link
              </p>
              <p className="mb-2 text-[11px] leading-snug text-muted">
                Add above the canvas (not inside the preview). The canvas shows plain text only; learners still get a
                clickable link that opens in a new tab.
              </p>
              <div className="flex flex-col gap-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block min-w-0 space-y-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Label</span>
                    <input
                      type="text"
                      value={linkLabelInput}
                      onChange={(e) => setLinkLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          applyEditorLink()
                        }
                      }}
                      placeholder="Text people see"
                      className={`${linkInputClass} w-full`}
                      autoComplete="off"
                      aria-label="Link label"
                    />
                  </label>
                  <label className="block min-w-0 space-y-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted">URL</span>
                    <input
                      type="text"
                      inputMode="url"
                      autoComplete="url"
                      value={linkUrlInput}
                      onChange={(e) => setLinkUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          applyEditorLink()
                        }
                      }}
                      placeholder="https://… or mailto:…"
                      className={`${linkInputClass} w-full`}
                      aria-label="Link URL"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!editor}
                    onClick={() => applyEditorLink()}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
                  >
                    Insert link
                  </button>
                  <button
                    type="button"
                    disabled={!editor}
                    onClick={() => clearEditorLink()}
                    className={toolbarBtn}
                    title="Remove link mark from cursor / selection"
                  >
                    Clear link
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Page canvas (drag images)</p>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted">
              <ImagePlus className="size-3.5" /> Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void addImage(f)
                }}
              />
            </label>
          </div>

          <div className={`rounded-lg border border-border ${standardPageOuterClass}`}>
            <div className={standardPageTitleClass}>{title || `${skillName} standard`}</div>
            <div ref={canvasRef} className={standardPageStageClass}>
              <div
                className={standardPageProseClass}
                dangerouslySetInnerHTML={{
                  __html: stripAnchorsForCanvasPreview(page?.contentHtml || '<p></p>'),
                }}
              />
            {(page?.images ?? []).map((img) => (
              <Rnd
                key={img.id}
                bounds="parent"
                size={{ width: (canvasSize.width * img.w) / 100, height: (canvasSize.height * img.h) / 100 }}
                position={{ x: (canvasSize.width * img.x) / 100, y: (canvasSize.height * img.y) / 100 }}
                onDragStop={(_, d) => {
                  const parent = canvasRef.current?.getBoundingClientRect()
                  if (!parent) return
                  const nx = Math.max(0, Math.min(95, Math.round((d.x / parent.width) * 100)))
                  const ny = Math.max(0, Math.min(95, Math.round((d.y / parent.height) * 100)))
                  setPages((prev) =>
                    prev.map((p, i) => {
                      if (i !== activePage) return p
                      return { ...p, images: p.images.map((x) => (x.id === img.id ? { ...x, x: nx, y: ny } : x)) }
                    }),
                  )
                }}
                onResizeStop={(_, __, ref, ___, position) => {
                  const parent = canvasRef.current?.getBoundingClientRect()
                  if (!parent) return
                  const nw = Math.max(8, Math.min(95, Math.round((ref.offsetWidth / parent.width) * 100)))
                  const nh = Math.max(8, Math.min(95, Math.round((ref.offsetHeight / parent.height) * 100)))
                  const nx = Math.max(0, Math.min(95, Math.round((position.x / parent.width) * 100)))
                  const ny = Math.max(0, Math.min(95, Math.round((position.y / parent.height) * 100)))
                  setPages((prev) =>
                    prev.map((p, i) => {
                      if (i !== activePage) return p
                      return {
                        ...p,
                        images: p.images.map((x) => (x.id === img.id ? { ...x, x: nx, y: ny, w: nw, h: nh } : x)),
                      }
                    }),
                  )
                }}
                className="z-10 rounded-md border border-border shadow"
              >
                <div className="relative h-full w-full">
                  {imageUrls[img.path] ? (
                    <img
                      src={imageUrls[img.path]}
                      alt=""
                      className="h-full w-full rounded-md bg-white object-contain object-center"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">Loading image…</div>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setPages((prev) =>
                        prev.map((p, i) => {
                          if (i !== activePage) return p
                          return { ...p, images: p.images.filter((x) => x.id !== img.id) }
                        }),
                      )
                    }
                    className="absolute right-1 top-1 rounded bg-white/95 px-1.5 py-0.5 text-[10px] text-danger"
                  >
                    Remove
                  </button>
                </div>
              </Rnd>
            ))}
            </div>
          </div>

          <p className="mt-2 text-[11px] text-muted">
            Paste or drop images here, then drag and resize with your mouse.
          </p>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving standards…' : 'Save standards'}
        </button>
      </div>
    </div>
  )
}
