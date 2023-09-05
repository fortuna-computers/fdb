package com.github.fortunacomputers.compiler.dto;

import java.util.List;

public record CompilationParameters(List<CompilationSource> sources, String serialPort, String compiler) {
    public record CompilationSource(String filename, int address) {}
}
