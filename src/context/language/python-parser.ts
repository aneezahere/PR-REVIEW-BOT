import { AbstractParser, EnclosingContext } from "../../constants";
export class PythonParser implements AbstractParser {
  findEnclosingContext(
    file: string,
    lineStart: number,
    lineEnd: number
  ): EnclosingContext {
    // TODO: Implement this method for Python
    return null;
  }
  dryRun(file: string): { valid: boolean; error: string } {
    // TODO: Implement this method for Python
    return { valid: false, error: "Not implemented yet" };
  }
}
