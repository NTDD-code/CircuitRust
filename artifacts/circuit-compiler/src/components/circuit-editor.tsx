import { useRef, useCallback, useEffect } from "react";
import MonacoEditor, { OnMount, Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditorNS, Position } from "monaco-editor";
import type { CompileError } from "@workspace/api-client-react";

const COMPONENT_TYPES = [
  "Resistor", "Capacitor", "Inductor", "Button", "Switch", "Crystal", "Transformer",
  "LED", "Diode", "ZenerDiode", "SchottkyDiode", "TVSDiode",
  "NPN", "PNP", "NMOSFET", "PMOSFET",
  "OpAmp741", "OpAmpTL082", "OpAmpLM358", "LevelShifter", "L298N", "IC",
  "VoltageRegulator", "LDO", "BuckConverter", "BoostConverter",
  "DHT11", "DHT22", "MPU6050", "Ultrasonic", "IRSensor", "PhotoResistor", "Thermistor",
  "ArduinoUno", "ArduinoNano", "ESP32", "ESP8266", "RaspberryPiPico",
];

const NET_TYPES = [
  { label: "power(5.0)", insert: "power(5.0);" },
  { label: "power(3.3)", insert: "power(3.3);" },
  { label: "power(12.0)", insert: "power(12.0);" },
  { label: "ground()", insert: "ground();" },
  { label: "signal()", insert: "signal();" },
];

interface CircuitEditorProps {
  value: string;
  onChange: (v: string) => void;
  onCompile: () => void;
  errors?: CompileError[];
  onInsertText?: (cb: (text: string) => void) => void;
  onScrollToLine?: (cb: (line: number) => void) => void;
}

export function CircuitEditor({ value, onChange, onCompile, errors, onInsertText, onScrollToLine }: CircuitEditorProps) {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const onCompileRef = useRef(onCompile);
  useEffect(() => { onCompileRef.current = onCompile; });

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    monaco.languages.register({ id: "circuit-dsl" });

    monaco.languages.setMonarchTokensProvider("circuit-dsl", {
      tokenizer: {
        root: [
          [/\/\/.*$/, "comment"],
          [/\blet\b/, "keyword"],
          [/connect!/, "keyword-connect"],
          [/Net::/, "net-prefix"],
          [/Component::/, "component-prefix"],
          [/\b(power|ground|signal)\b(?=\()/, "builtin"],
          [/"[^"]*"/, "string"],
          [/\b\d+(\.\d+)?\b/, "number"],
          [/[=>(){};,.]/, "delimiter"],
          [/[A-Za-z_]\w*/, "identifier"],
        ],
      },
    });

    monaco.editor.defineTheme("circuit-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A737D", fontStyle: "italic" },
        { token: "keyword", foreground: "FF7B72", fontStyle: "bold" },
        { token: "keyword-connect", foreground: "FF7B72", fontStyle: "bold" },
        { token: "component-prefix", foreground: "79C0FF" },
        { token: "net-prefix", foreground: "56D364" },
        { token: "builtin", foreground: "56D364" },
        { token: "string", foreground: "A5D6FF" },
        { token: "number", foreground: "F0883E" },
        { token: "identifier", foreground: "C9D1D9" },
        { token: "delimiter", foreground: "8B949E" },
      ],
      colors: {
        "editor.background": "#0D1117",
        "editor.foreground": "#C9D1D9",
        "editorLineNumber.foreground": "#6E7681",
        "editorLineNumber.activeForeground": "#C9D1D9",
        "editor.lineHighlightBackground": "#161B2280",
        "editorCursor.foreground": "#58A6FF",
        "editor.selectionBackground": "#264F7840",
        "editorIndentGuide.background1": "#21262D",
        "editorBracketMatch.background": "#388BFD3A",
        "editorBracketMatch.border": "#388BFD",
        "editor.wordHighlightBackground": "#1F6FEB33",
        "scrollbarSlider.background": "#30363D88",
        "scrollbarSlider.hoverBackground": "#30363DAA",
      },
    });

    monaco.editor.setTheme("circuit-dark");

    monaco.languages.registerCompletionItemProvider("circuit-dsl", {
      triggerCharacters: [":", " ", ".", "("],
      provideCompletionItems(model: MonacoEditorNS.ITextModel, position: Position) {
        const lineText = model.getLineContent(position.lineNumber);
        const textBefore = lineText.substring(0, position.column - 1);
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        if (textBefore.endsWith("Component::")) {
          return {
            suggestions: COMPONENT_TYPES.map((t) => ({
              label: t,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: t,
              range,
              detail: "Component type",
            })),
          };
        }

        if (textBefore.endsWith("Net::")) {
          return {
            suggestions: NET_TYPES.map((n) => ({
              label: n.label,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: n.insert,
              range,
              detail: "Net type",
            })),
          };
        }

        if (/^\s*let\s+\w*$/.test(textBefore)) {
          return {
            suggestions: [
              {
                label: "let ... = Component::",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "${1:id} = Component::${2:Resistor};",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
                detail: "Component declaration",
              },
              {
                label: "let ... = Net::power",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "${1:vcc} = Net::power(${2:5.0});",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
                detail: "Power net declaration",
              },
              {
                label: "let ... = Net::ground",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "${1:gnd} = Net::ground();",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
                detail: "Ground net declaration",
              },
            ],
          };
        }

        if (/^\s*connect!\($/.test(textBefore) || textBefore.endsWith("connect!(")) {
          return {
            suggestions: [
              {
                label: "connect!(... => ...);",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "${1:src} => ${2:dest});",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
                detail: "Connection statement",
              },
            ],
          };
        }

        return { suggestions: [] };
      },
    });

    monaco.languages.registerHoverProvider("circuit-dsl", {
      provideHover(model: MonacoEditorNS.ITextModel, position: Position) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const compIdx = COMPONENT_TYPES.indexOf(word.word);
        if (compIdx >= 0) {
          return {
            contents: [
              { value: `**Component::${word.word}**` },
              { value: `Circuit component. Declare with: \`let id = Component::${word.word};\`` },
            ],
          };
        }
        return null;
      },
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => onCompileRef.current()
    );

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        localStorage.setItem("scc_last_source", editor.getValue());
      }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (onInsertText) {
    onInsertText((text: string) => {
      if (editorRef.current) {
        editorRef.current.setValue(text);
      }
    });
  }

  if (onScrollToLine) {
    onScrollToLine((line: number) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
      const model = editor.getModel();
      if (model) {
        editor.setSelection({
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: model.getLineLength(line) + 1,
        });
      }
    });
  }

  if (errors && monacoRef.current && editorRef.current) {
    const model = editorRef.current.getModel();
    if (model) {
      const markers = errors.map((err) => ({
        severity: monacoRef.current!.MarkerSeverity.Error,
        message: `[${err.errorCode}] ${err.message}`,
        startLineNumber: err.line,
        startColumn: err.column || 1,
        endLineNumber: err.line,
        endColumn: model.getLineLength(err.line) + 1,
      }));
      monacoRef.current.editor.setModelMarkers(model, "circuit-dsl", markers);
    }
  }

  return (
    <MonacoEditor
      language="circuit-dsl"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      theme="circuit-dark"
      options={{
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
        fontLigatures: true,
        lineNumbers: "on",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        automaticLayout: true,
        padding: { top: 16, bottom: 16 },
        renderWhitespace: "boundary",
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        renderLineHighlight: "all",
        scrollbar: {
          vertical: "auto",
          horizontal: "auto",
          useShadows: false,
        },
      }}
    />
  );
}
