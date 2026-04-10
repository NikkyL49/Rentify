/*
 styles.d.ts
 
 This file tells TypeScript how to handle non-TS module imports,
 such as CSS files. Without this, importing files like './globals.css'
 would cause TS errors because it doesn’t know their types.
 
 It allows CSS files to be imported safely for side effects or class mappings.
 */

declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}