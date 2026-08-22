const canvas = document.getElementById('shader-canvas');
const gl = canvas.getContext('webgl');

const vsSource = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fsSource = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    vec3 color = vec3(st.x, st.y, abs(sin(u_time)));
    gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1,
]), gl.STATIC_DRAW);

const aPositionLocation = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(aPositionLocation);
gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);

const timeLocation = gl.getUniformLocation(program, "u_time");
const resLocation = gl.getUniformLocation(program, "u_resolution");

function render(time) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
}
requestAnimationFrame(render);