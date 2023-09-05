package com.github.fortunacomputers.compiler;

import com.github.fortunacomputers.compiler.dto.CompilationParameters;
import com.github.fortunacomputers.compiler.dto.CompilerResultDTO;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Component
public class CompilerService {

    private Path tempDir;

    @PostConstruct
    public void init() throws IOException {

        tempDir = Files.createTempDirectory("compiler");

        // ensure temp dir is deleted at exit
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                Files.walk(tempDir).map(Path::toFile).forEach(File::delete);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }));
    }

    public CompilerResultDTO compile(String compiler, List<CompilationParameters.CompilationSource> sources) {
        extractCompiler(compiler);
        return null;
    }

    public void extractCompiler(String compiler) {
        InputStream resourceStream = CompilerService.class.getResourceAsStream("/compiler/" + System.getProperty("os.name") + "/vasmz80_oldstyle");
    }

}
