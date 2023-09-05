package com.github.fortunacomputers.setup;

import com.github.fortunacomputers.compiler.CompilerService;
import com.github.fortunacomputers.compiler.dto.CompilationParameters;
import com.github.fortunacomputers.compiler.dto.CompilerResultDTO;
import com.github.fortunacomputers.serial.SerialService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController("/setup")
@RequiredArgsConstructor
public class SetupRestController {

    private final SerialService serialService;
    private final CompilerService compilerService;

    @PostMapping
    public CompilerResultDTO setup(@RequestBody CompilationParameters parameters) {

        serialService.open(parameters.serialPort());
        return compilerService.compile(parameters.compiler(), parameters.sources());
    }
}
