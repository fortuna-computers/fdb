package com.github.fortunacomputers.compiler.dto;

import java.util.List;

public record CompilerResultDTO(CompilationResult result, List<SourceFile> sourceFiles, List<Symbol> symbols, byte[] rom) {

    public record CompilationResult(boolean success, String outMessage, String errMessage) {}
    public record SourceFile(String filename, List<SourceLine> sourceLines) {}

    public record SourceLine(int address, String line) {}
    public record Symbol(String symbol, int address) {}
}
