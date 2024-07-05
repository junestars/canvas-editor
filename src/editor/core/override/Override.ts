import { IPasteEventData } from '../../interface/Event'

export interface IOverrideResult {
  preventDefault?: boolean
}

export class Override {
  public paste:
    | ((
        evt?: ClipboardEvent | IPasteEventData
      ) => unknown | IOverrideResult | Promise<unknown>)
    | undefined
  public copy: (() => unknown | IOverrideResult) | undefined
  public drop: ((evt: DragEvent) => unknown | IOverrideResult) | undefined
}
