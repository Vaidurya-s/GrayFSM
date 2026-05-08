"""
Verilog Testbench Exporter

Generates a Verilog testbench for testing a synthesized FSM module.
Includes clock generation, reset sequencing, stimulus generation, and waveform dumping.
"""

from typing import Dict, List, Optional

from app.utils.exceptions import ExportException


class TestbenchExporter:
    """Generates Verilog testbench for FSM testing"""

    def export(
        self,
        definition: dict,
        fsm_type: str,
        name: str,
        options: Optional[Dict] = None,
    ) -> str:
        """
        Generate a Verilog testbench for the given FSM.

        Args:
            definition: FSM definition dict with states, transitions, outputs, encodings
            fsm_type: 'moore' or 'mealy'
            name: FSM name (used as DUT module name)
            options: Optional settings (
                module_name: DUT module name (default: sanitized name),
                clock_period: clock period in ns (default: 10),
                include_waveform: enable VCD output (default: true)
            )

        Returns:
            Verilog testbench source code as a string

        Raises:
            ExportException: If the definition is invalid
        """
        options = options or {}
        dut_module_name = options.get("module_name", self._sanitize_name(name))
        clock_period = options.get("clock_period", 10)
        include_waveform = options.get("include_waveform", True)

        states = definition.get("states", [])
        transitions = definition.get("transitions", [])
        outputs = definition.get("outputs", {})
        definition.get("initial_state", "")

        if not states:
            raise ExportException("FSM has no states to export")

        # Collect unique inputs
        inputs = set()
        for t in transitions:
            inp = t.get("input")
            if inp:
                inputs.add(inp)

        # Determine output bit width
        output_values = set(outputs.values()) if outputs else set()
        output_bits = 1
        if output_values:
            max_len = max(len(v) for v in output_values)
            output_bits = max(max_len, 1)

        lines = []

        # Timescale directive
        lines.append("`timescale 1ns/1ps")
        lines.append("")

        # Testbench module
        lines.append(f"module {self._sanitize_name(name)}_tb ();")
        lines.append("")

        # Clock period constants
        half_period = clock_period // 2
        lines.append("    // Clock configuration")
        lines.append(f"    localparam CLOCK_PERIOD = {clock_period};")
        lines.append(f"    localparam HALF_PERIOD = {half_period};")
        lines.append("    localparam RESET_TIME = 20;")
        lines.append("")

        # Signal declarations
        lines.append("    // Testbench signals")
        lines.append("    reg clk;")
        lines.append("    reg rst_n;")
        for inp in sorted(inputs):
            lines.append(f"    reg {self._sanitize_name(inp)};")
        lines.append(f"    wire [{output_bits - 1}:0] out;")
        lines.append("")

        # DUT instantiation
        lines.append("    // Device Under Test (DUT)")
        lines.append(f"    {dut_module_name} dut (")
        lines.append("        .clk(clk),")
        lines.append("        .rst_n(rst_n),")
        for inp in sorted(inputs):
            sanitized = self._sanitize_name(inp)
            lines.append(f"        .{sanitized}({sanitized}),")
        lines.append("        .out(out)")
        lines.append("    );")
        lines.append("")

        # Clock generation
        lines.append("    // Clock generation (10ns period: 5ns high, 5ns low)")
        lines.append("    initial begin")
        lines.append("        clk = 1'b0;")
        lines.append("        forever #HALF_PERIOD clk = ~clk;")
        lines.append("    end")
        lines.append("")

        # Reset and stimulus
        lines.append("    // Reset and stimulus generation")
        lines.append("    initial begin")
        if include_waveform:
            lines.append(f'        $dumpfile("{self._sanitize_name(name)}_tb.vcd");')
            lines.append(f"        $dumpvars(0, {self._sanitize_name(name)}_tb);")
        lines.append("")

        # Reset sequence
        lines.append("        // Assert reset for 20ns")
        lines.append("        rst_n = 1'b0;")
        for inp in sorted(inputs):
            lines.append(f"        {self._sanitize_name(inp)} = 1'b0;")
        lines.append("        #RESET_TIME;")
        lines.append("        rst_n = 1'b1;")
        lines.append("")

        # Stimulus: one transition per input
        if transitions:
            lines.append("        // Apply stimulus for each transition")
            # Group transitions by from_state for organized stimulus
            trans_by_state: Dict[str, List[Dict]] = {}
            for t in transitions:
                fs = t.get("from_state", "")
                trans_by_state.setdefault(fs, []).append(t)

            for state in states:
                state_trans = trans_by_state.get(state, [])
                if not state_trans:
                    continue

                self._sanitize_name(state)
                for t in state_trans:
                    inp = t.get("input")
                    if inp:
                        sanitized_inp = self._sanitize_name(inp)
                        lines.append(
                            f"        @(posedge clk) {sanitized_inp} = 1'b1; "
                            f"// Transition from {state} on {inp}"
                        )
                        lines.append(f"        @(posedge clk) {sanitized_inp} = 1'b0;")
                        lines.append(
                            '        $display("Time: %0d, State: %b, Output: %b", '
                            "$time, dut.current_state, out);"
                        )

        lines.append("")
        lines.append("        // Test complete")
        lines.append("        #(CLOCK_PERIOD * 2);")
        lines.append("        $finish;")
        lines.append("    end")
        lines.append("")

        lines.append("endmodule")
        lines.append("")

        return "\n".join(lines)

    @staticmethod
    def _sanitize_name(name: str) -> str:
        """
        Sanitize a name for use as a Verilog identifier.
        Replaces non-alphanumeric characters with underscores.
        """
        sanitized = ""
        for ch in name:
            if ch.isalnum() or ch == "_":
                sanitized += ch
            else:
                sanitized += "_"
        # Ensure it starts with a letter or underscore
        if sanitized and sanitized[0].isdigit():
            sanitized = "_" + sanitized
        return sanitized or "_unnamed"
