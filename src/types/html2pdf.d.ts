declare module "html2pdf.js" {
  type Options = {
    margin?: number | number[];
    filename?: string;
    image?: { type: string; quality: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: Record<string, unknown>;
    pagebreak?: Record<string, unknown>;
  };

  type Worker = {
    set(options: Options): Worker;
    from(element: HTMLElement): Worker;
    save(): Promise<void>;
  };

  export default function html2pdf(): Worker;
}
