import { IElement } from './Element'
import { RangeRect } from './Range'

/**
 * 从 paste 事件中的 rtf 格式的数据中提取中的文件
 */
export interface IImageHexSource {
  type: string
  hex: string
}

/**
 * 从 paste 事件中提取的数据对象
 */
export interface IPasteEventData {
  text: string
  html: string
  rtf: string
  files: File[]
}

export interface IPasteOption {
  isPlainText: boolean
}

export interface IPositionContextByEvent {
  pageNo: number
  element: IElement | null
  rangeRect: RangeRect | null
}
