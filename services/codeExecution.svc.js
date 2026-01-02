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
        compile: async (file, workDir) => {
          // Extract the public class name from the Java file
          const content = await fs.readFile(file, 'utf-8');
          const classMatch = content.match(/public\s+class\s+(\w+)/);
          const className = classMatch ? classMatch[1] : 'Main';

          // Rename file to match class name
          const correctFile = path.join(path.dirname(file), `${className}.java`);
          if (file !== correctFile) {
            await fs.rename(file, correctFile);
          }

          // Compile
          await this.runCommand('javac', [correctFile], '', 30000);
          return className;
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
      let args = [];

      if (langConfig.compile) {
        executablePath = await langConfig.compile(filepath, workDir);
        // For Java, we need to run with classpath pointing to workDir
        args = ['-cp', workDir, executablePath];
      } else {
        args = [executablePath];
      }

      // Run the code with proper working directory for Java
      const { stdout } = await this.runCommandInDir(
        langConfig.cmd,
        args,
        testCase.input,
        timeoutSeconds * 1000,
        workDir
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

  async runCommandInDir(cmd, args, input = '', timeout = 10000, workDir = null) {
    return new Promise((resolve, reject) => {
      const options = {};
      if (workDir) {
        options.cwd = workDir;
      }

      const process = spawn(cmd, args, options);
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

  normalizeOutput(text) {
    // Normalize output: trim, remove trailing newlines, collapse multiple spaces
    return text
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  validateOutput(output, expectedOutput) {
    const normalized1 = this.normalizeOutput(output);
    const normalized2 = this.normalizeOutput(expectedOutput);
    return normalized1 === normalized2;
  }
}

module.exports = new CodeExecutionService();