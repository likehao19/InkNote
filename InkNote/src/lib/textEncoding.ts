export interface TextEncoding {
  name: string;
  bom: boolean;
}

export const UTF8_TEXT_ENCODING: TextEncoding = {
  name: "UTF-8",
  bom: false,
};

export function copyTextEncoding(encoding: TextEncoding): TextEncoding {
  return { name: encoding.name, bom: encoding.bom };
}
