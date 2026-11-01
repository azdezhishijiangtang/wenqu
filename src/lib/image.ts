/**
 * 图片压缩：文件/剪贴板图片 → dataURL。
 * 最长边压到 1280px、JPEG 0.9，单图体积控制在 ~300KB，
 * 保证 base64 后不会撑爆请求体，文字仍清晰可读。
 */

const MAX_EDGE = 1280
const QUALITY = 0.9
export const MAX_IMAGES = 3

export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('只能发送图片文件（截图或照片）。')
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('图片超过 20MB，请先裁剪或压缩。')
  }

  const dataUrl = await readAsDataUrl(file)
  const image = await loadImage(dataUrl)

  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return dataUrl
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', QUALITY)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败，请重试。'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败，请换一张试试。'))
    image.src = src
  })
}
