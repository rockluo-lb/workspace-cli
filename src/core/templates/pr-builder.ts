import { PRBuildInput, PRBuilder } from "../shared/types.js";
import { renderPrMarkdown } from "./pr-template.js";

export class MarkdownPrBuilder implements PRBuilder {
  async build(input: PRBuildInput): Promise<string> {
    return renderPrMarkdown(input);
  }
}
