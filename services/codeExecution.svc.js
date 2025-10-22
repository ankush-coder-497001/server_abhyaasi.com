const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

class CodeExecutionService {
  constructor() {
    this.supportedLanguages = {
      javascript: {
        ext: 'js',
        cmd: 'node',
        setup: () => Promise.resolve()
      },
      python: {
        ext: 'py',
        cmd: 'python',
        setup: () => Promise.resolve()
      },
      java: {
        ext: 'java',
        cmd: 'java',
        compile: async (file) => {
          await this.runCommand('javac', [file]);
          return file.replace('.java', '');
        }
      },
      cpp: {
        ext: 'cpp',
        cmd: './a.out',
        compile: async (file) => {
          await this.runCommand('g++', [file]);
          return './a.out';
        }
      }
    };
  }

  async createTempDir() {
    const id = crypto.randomBytes(16).toString('hex');
    const dir = path.join(os.tmpdir(), `code-execution-${id}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async runCommand(cmd, args, input = '', timeout = 10000) {
    return new Promise((resolve, reject) => {
      const process = spawn(cmd, args);
      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        process.kill();
        reject(new Error('Execution timed out'));
      }, timeout);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timer);
        if (!killed) {
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(new Error(stderr || `Process exited with code ${code}`));
          }
        }
      });

      if (input) {
        process.stdin.write(input);
        process.stdin.end();
      }
    });
  }

  async executeCode(language, code, testCase, timeoutSeconds = 10) {
    const langConfig = this.supportedLanguages[language.toLowerCase()];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const workDir = await this.createTempDir();
    const filename = `main.${langConfig.ext}`;
    const filepath = path.join(workDir, filename);

    try {
      // Write code to file
      await fs.writeFile(filepath, code);

      // Compile if needed
      let executablePath = filepath;
      if (langConfig.compile) {
        executablePath = await langConfig.compile(filepath);
      }

      // Run the code
      const { stdout } = await this.runCommand(
        langConfig.cmd,
        [executablePath],
        testCase.input,
        timeoutSeconds * 1000
      );

      // Clean up
      await fs.rm(workDir, { recursive: true, force: true });

      return {
        output: stdout.trim(),
        error: null
      };
    } catch (error) {
      // Clean up on error
      await fs.rm(workDir, { recursive: true, force: true });
      return {
        output: null,
        error: error.message
      };
    }
  }

  validateOutput(output, expectedOutput) {
    return output.trim() === expectedOutput.trim();
  }
}

module.exports = new CodeExecutionService();