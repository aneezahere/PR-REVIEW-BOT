import { AbstractParser, EnclosingContext } from "../../constants";
import * as parser from "@babel/parser";
import traverse, { NodePath, Node } from "@babel/traverse";

export class JavascriptParser implements AbstractParser {
  findEnclosingContext(
    file: string,
    lineStart: number,
    lineEnd: number
  ): EnclosingContext {
    const ast = parser.parse(file, {
      sourceType: "module",
      plugins: ["jsx", "typescript"], // To allow JSX and TypeScript
    });

    let enclosingContext: Node = null;

    traverse(ast, {
      enter(path) {
        const { start, end } = path.node.loc || {};
        if (start && end && start.line <= lineStart && lineEnd <= end.line) {
          // Capture the first matching enclosing context
          if (!enclosingContext) {
            enclosingContext = path.node;
          }
        }
      },
    });

    // If no specific context is found, return the entire AST as context
    return {
      enclosingContext: enclosingContext || ast,
    } as EnclosingContext;
  }

  dryRun(file: string): { valid: boolean; error: string } {
    try {
      parser.parse(file, {
        sourceType: "module",
        plugins: ["jsx", "typescript"], // To allow JSX and TypeScript
      });
      return {
        valid: true,
        error: "",
      };
    } catch (exc) {
      return {
        valid: false,
        error: exc.toString(),
      };
    }
  }
}