/* StudioLab v3 - Motor de cuestionarios. Sin dependencias externas. */
"use strict";

const $ = (selector) => document.querySelector(selector);

// Ruta relativa compatible con GitHub Pages, incluso en repositorios de proyecto.
const DEFAULT_QUESTIONNAIRE_URL = new URL("./datos/preguntas.json", document.baseURI);

const elements = {
  loading: $("#loading-view"),
  empty: $("#empty-view"),
  error: $("#error-view"),
  quiz: $("#quiz-view"),
  results: $("#results-view"),
  fileInput: $("#file-input"),
  title: $("#quiz-title"),
  description: $("#quiz-description"),
  counter: $("#question-counter"),
  progress: $("#progress-bar"),
  type: $("#question-type"),
  points: $("#question-points"),
  question: $("#question-text"),
  instruction: $("#question-instruction"),
  form: $("#answer-form"),
  answerArea: $("#answer-area"),
  answerError: $("#answer-error"),
  submit: $("#submit-button"),
  feedback: $("#feedback-panel"),
  feedbackIcon: $("#feedback-icon"),
  feedbackTitle: $("#feedback-title"),
  feedbackScore: $("#feedback-score"),
  feedbackExplanation: $("#feedback-explanation"),
  feedbackDetail: $("#feedback-detail"),
  next: $("#next-button"),
  answered: $("#answered-counter")
};

let questionnaire = null;
let sourceQuestionnaire = null;
let currentIndex = 0;
let answers = [];
let currentFileName = "preguntas.json";

function showView(name) {
  for (const key of ["loading", "empty", "error", "quiz", "results"]) {
    elements[key].hidden = key !== name;
  }
}

function showError(message, view = "error") {
  if (view === "empty") {
    $("#empty-message").textContent = message;
    showView("empty");
  } else {
    $("#error-message").textContent = message;
    showView("error");
  }
}

async function loadDefaultQuestionnaire() {
  showView("loading");
  try {
    const response = await fetch(DEFAULT_QUESTIONNAIRE_URL, { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("No se ha encontrado datos/preguntas.json. Selecciona un cuestionario o coloca el archivo predeterminado en la carpeta datos.");
      }
      throw new Error(`No se pudo cargar el archivo (HTTP ${response.status}).`);
    }
    const data = await response.json();
    startQuestionnaire(data, "preguntas.json");
  } catch (error) {
    const message = error instanceof TypeError
      ? "No se pudo cargar datos/preguntas.json. Comprueba que el archivo está en la carpeta datos del repositorio y que GitHub Pages ha terminado de publicar los cambios. Si estás trabajando en local, inicia la aplicación con Live Server. También puedes cargar un JSON manualmente."
      : error.message;
    showError(message, "empty");
  }
}

async function loadSelectedFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    startQuestionnaire(data, file.name);
  } catch (error) {
    showError(error instanceof SyntaxError
      ? "El archivo no contiene JSON válido. Revisa las comas, comillas y llaves."
      : error.message);
  } finally {
    elements.fileInput.value = "";
  }
}

function validateQuestionnaire(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("El documento debe ser un objeto JSON.");
  }
  if (typeof data.titulo !== "string" || !data.titulo.trim()) {
    throw new Error('Falta la propiedad "titulo" o no es un texto válido.');
  }
  if (!Array.isArray(data.preguntas) || data.preguntas.length === 0) {
    throw new Error('La propiedad "preguntas" debe contener al menos una pregunta.');
  }

  const ids = new Set();
  data.preguntas.forEach((q, index) => {
    const label = `Pregunta ${index + 1}`;
    if (!q || typeof q !== "object" || Array.isArray(q)) throw new Error(`${label}: formato incorrecto.`);
    if (q.id === undefined || q.id === null || ids.has(String(q.id))) throw new Error(`${label}: falta un identificador o está duplicado.`);
    ids.add(String(q.id));
    if (!["test", "multiple", "corta"].includes(q.tipo)) throw new Error(`${label}: tipo no reconocido. Usa test, multiple o corta.`);
    if (typeof q.enunciado !== "string" || !q.enunciado.trim()) throw new Error(`${label}: falta el enunciado.`);
    if (q.tipo === "test" || q.tipo === "multiple") {
      if (!Array.isArray(q.opciones) || q.opciones.length !== 4 || q.opciones.some(o => typeof o !== "string" || !o.trim())) {
        throw new Error(`${label}: las preguntas tipo test y múltiple deben tener exactamente cuatro opciones de texto.`);
      }
      if (!Array.isArray(q.correctas) || q.correctas.length === 0) throw new Error(`${label}: falta el array "correctas".`);
      const unique = [...new Set(q.correctas)];
      if (unique.length !== q.correctas.length || unique.some(n => !Number.isInteger(n) || n < 0 || n > 3)) {
        throw new Error(`${label}: "correctas" debe contener índices únicos entre 0 y 3.`);
      }
      if (q.tipo === "test" && q.correctas.length !== 1) throw new Error(`${label}: una pregunta test debe tener una sola respuesta correcta.`);
      if (q.tipo === "multiple" && (q.correctas.length < 1 || q.correctas.length > 4)) {
        throw new Error(`${label}: una pregunta de selección múltiple debe tener entre una y cuatro respuestas correctas.`);
      }
    }
    if (q.tipo === "corta") {
      if (!Array.isArray(q.criterios) || q.criterios.length === 0) throw new Error(`${label}: falta el array "criterios".`);
      if (q.criterios.some(group => !Array.isArray(group) || group.length === 0 || group.some(v => typeof v !== "string" || !v.trim()))) {
        throw new Error(`${label}: cada criterio debe ser un array de palabras o expresiones aceptadas.`);
      }
    }
  });
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createQuizAttempt(data) {
  const questions = shuffleArray(data.preguntas).map(question => {
    // Se crea una copia para no modificar nunca el JSON original.
    const copy = { ...question };
    if (question.tipo === "test" || question.tipo === "multiple") {
      const indexedOptions = question.opciones.map((text, originalIndex) => ({ text, originalIndex }));
      const shuffledOptions = shuffleArray(indexedOptions);
      const newIndexByOriginal = new Map(
        shuffledOptions.map((option, newIndex) => [option.originalIndex, newIndex])
      );
      copy.opciones = shuffledOptions.map(option => option.text);
      copy.correctas = question.correctas.map(index => newIndexByOriginal.get(index));
    }
    return copy;
  });
  return { ...data, preguntas: questions };
}

function startQuestionnaire(data, fileName) {
  validateQuestionnaire(data);
  sourceQuestionnaire = data;
  questionnaire = createQuizAttempt(data);
  currentFileName = fileName;
  currentIndex = 0;
  answers = [];
  elements.title.textContent = data.titulo;
  elements.description.textContent = data.descripcion || `Archivo: ${fileName} · ${data.preguntas.length} preguntas`;
  showView("quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = questionnaire.preguntas[currentIndex];
  const total = questionnaire.preguntas.length;
  const valuePerQuestion = 10 / total;

  elements.counter.textContent = `Pregunta ${currentIndex + 1} de ${total}`;
  elements.progress.style.width = `${(currentIndex / total) * 100}%`;
  elements.type.textContent = q.tipo === "test" ? "TEST" : q.tipo === "multiple" ? "SELECCIÓN MÚLTIPLE" : "RESPUESTA CORTA";
  elements.points.textContent = `${formatNumber(valuePerQuestion)} puntos posibles`;
  elements.question.textContent = q.enunciado;
  elements.instruction.textContent = q.tipo === "test"
    ? "Selecciona una única respuesta."
    : q.tipo === "multiple"
      ? "Selecciona todas las respuestas que consideres correctas."
      : "Escribe una respuesta de un máximo de cinco palabras.";
  elements.answerArea.replaceChildren();
  elements.answerError.hidden = true;
  elements.feedback.hidden = true;
  elements.feedback.className = "feedback-panel";
  elements.submit.hidden = false;
  elements.submit.disabled = false;
  elements.next.hidden = true;
  elements.next.textContent = currentIndex === total - 1 ? "Ver resultados" : "Siguiente pregunta →";

  if (q.tipo === "test" || q.tipo === "multiple") {
    q.opciones.forEach((option, index) => {
      const label = document.createElement("label");
      label.className = "option-label";
      const input = document.createElement("input");
      input.type = q.tipo === "test" ? "radio" : "checkbox";
      input.name = "answer";
      input.value = String(index);
      const key = document.createElement("span");
      key.className = "option-key";
      key.textContent = String.fromCharCode(65 + index);
      const text = document.createElement("span");
      text.textContent = option;
      label.append(input, key, text);
      elements.answerArea.append(label);
    });
  } else {
    const input = document.createElement("input");
    input.className = "short-answer";
    input.type = "text";
    input.id = "short-answer";
    input.name = "answer";
    input.maxLength = 100;
    input.autocomplete = "off";
    input.placeholder = "Escribe tu respuesta…";
    input.setAttribute("aria-label", "Respuesta corta, máximo cinco palabras");
    const counter = document.createElement("div");
    counter.className = "word-counter";
    counter.id = "word-counter";
    counter.textContent = "0 / 5 palabras";
    input.addEventListener("input", () => {
      const words = countWords(input.value);
      counter.textContent = `${words} / 5 palabras`;
      counter.classList.toggle("over-limit", words > 5);
    });
    elements.answerArea.append(input, counter);
    input.focus();
  }

  elements.answered.textContent = `${answers.length} respondidas`;
}

function countWords(value) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

function normalize(value) {
  return String(value)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function containsPhrase(answer, phrase) {
  const normalizedAnswer = ` ${normalize(answer)} `;
  const normalizedPhrase = normalize(phrase);
  return normalizedPhrase.length > 0 && normalizedAnswer.includes(` ${normalizedPhrase} `);
}

function correctCurrentAnswer(event) {
  event.preventDefault();
  const q = questionnaire.preguntas[currentIndex];
  let result;

  if (q.tipo === "test") {
    const selected = elements.answerArea.querySelector('input[name="answer"]:checked');
    if (!selected) return showAnswerError("Selecciona una respuesta antes de continuar.");
    const chosen = Number(selected.value);
    const isCorrect = q.correctas.includes(chosen);
    result = {
      fraction: isCorrect ? 1 : 0,
      userAnswer: q.opciones[chosen],
      detail: isCorrect ? "Has seleccionado la opción correcta." : `Respuesta correcta: ${q.opciones[q.correctas[0]]}.`
    };
  } else if (q.tipo === "multiple") {
    const selected = [...elements.answerArea.querySelectorAll('input[name="answer"]:checked')].map(input => Number(input.value));
    if (selected.length === 0) return showAnswerError("Selecciona al menos una opción.");
    const correctSet = new Set(q.correctas);
    const hits = selected.filter(index => correctSet.has(index)).length;
    const errors = selected.filter(index => !correctSet.has(index)).length;
    const fraction = Math.max(0, Math.min(1, (hits - errors) / q.correctas.length));
    result = {
      fraction,
      userAnswer: selected.map(index => q.opciones[index]).join(", "),
      detail: `${hits} acierto(s) y ${errors} selección(es) incorrecta(s). Respuestas válidas: ${q.correctas.map(index => q.opciones[index]).join(", ")}.`
    };
  } else {
    const input = $("#short-answer");
    const value = input.value.trim();
    if (!value) return showAnswerError("Escribe una respuesta antes de continuar.");
    if (countWords(value) > 5) return showAnswerError("La respuesta no puede superar las cinco palabras.");
    const matched = q.criterios.filter(group => group.some(alias => containsPhrase(value, alias))).length;
    const fraction = matched / q.criterios.length;
    result = {
      fraction,
      userAnswer: value,
      detail: `Has identificado ${matched} de ${q.criterios.length} conceptos evaluables.`
    };
  }

  const points = (10 / questionnaire.preguntas.length) * result.fraction;
  result.points = points;
  result.explanation = q.explicacion || "";
  result.question = q.enunciado;
  result.type = q.tipo;
  answers[currentIndex] = result;
  showFeedback(result);
}

function showAnswerError(message) {
  elements.answerError.textContent = message;
  elements.answerError.hidden = false;
}

function showFeedback(result) {
  elements.submit.hidden = true;
  elements.answerArea.querySelectorAll("input").forEach(input => input.disabled = true);
  elements.feedback.hidden = false;
  elements.next.hidden = false;

  const fraction = result.fraction;
  const status = fraction >= 0.999 ? "correct" : fraction > 0 ? "partial" : "wrong";
  elements.feedback.classList.add(status === "correct" ? "is-correct" : status === "partial" ? "is-partial" : "is-wrong");
  elements.feedbackIcon.textContent = status === "correct" ? "✓" : status === "partial" ? "◐" : "×";
  elements.feedbackTitle.textContent = status === "correct" ? "¡Respuesta correcta!" : status === "partial" ? "Respuesta parcialmente correcta" : "Respuesta incorrecta";
  elements.feedbackScore.textContent = `Has conseguido ${formatNumber(result.points)} de ${(10 / questionnaire.preguntas.length).toFixed(2).replace(".", ",")} puntos.`;
  elements.feedbackExplanation.textContent = result.explanation || result.detail;
  elements.feedbackDetail.textContent = result.explanation ? result.detail : "";
  elements.feedbackDetail.hidden = !result.explanation;
  elements.progress.style.width = `${((currentIndex + 1) / questionnaire.preguntas.length) * 100}%`;
  elements.answered.textContent = `${answers.filter(Boolean).length} respondidas`;
}

function goNext() {
  if (currentIndex < questionnaire.preguntas.length - 1) {
    currentIndex += 1;
    renderQuestion();
  } else {
    showResults();
  }
}

function formatNumber(number) {
  return Number(number).toFixed(2).replace(".", ",");
}

function showResults() {
  const total = questionnaire.preguntas.length;
  const totalFraction = answers.reduce((sum, answer) => sum + answer.fraction, 0);
  const grade = (10 * totalFraction) / total;
  const correct = answers.filter(answer => answer.fraction >= 0.999).length;
  const partial = answers.filter(answer => answer.fraction > 0 && answer.fraction < 0.999).length;
  const incorrect = total - correct - partial;

  $("#final-grade").textContent = formatNumber(grade);
  $("#score-ring").style.setProperty("--score", `${grade * 10}%`);
  $("#correct-count").textContent = correct;
  $("#partial-count").textContent = partial;
  $("#incorrect-count").textContent = incorrect;
  $("#results-subtitle").textContent = questionnaire.titulo;
  $("#results-summary").textContent = `Has obtenido ${formatNumber(grade)} puntos sobre 10 en ${total} preguntas.`;
  $("#review-section").hidden = true;
  $("#review-button").textContent = "Revisar respuestas";
  renderReview();
  showView("results");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderReview() {
  const list = $("#review-list");
  list.replaceChildren();
  $("#review-total").textContent = `${answers.length} preguntas`;
  answers.forEach((answer, index) => {
    const item = document.createElement("article");
    item.className = "review-item";
    const top = document.createElement("div");
    top.className = "review-item-top";
    const heading = document.createElement("h3");
    heading.textContent = `${index + 1}. ${answer.question}`;
    const status = document.createElement("span");
    const kind = answer.fraction >= .999 ? "good" : answer.fraction > 0 ? "partial" : "bad";
    status.className = `review-result ${kind}`;
    status.textContent = `${formatNumber(answer.points)} pt`;
    top.append(heading, status);
    const response = document.createElement("p");
    response.className = "review-answer";
    response.textContent = `Tu respuesta: ${answer.userAnswer}`;
    item.append(top, response);
    if (answer.detail) {
      const detail = document.createElement("p");
      detail.className = "review-explanation";
      detail.textContent = answer.detail;
      item.append(detail);
    }
    if (answer.explanation) {
      const explanation = document.createElement("p");
      explanation.className = "review-explanation";
      explanation.textContent = `Explicación: ${answer.explanation}`;
      item.append(explanation);
    }
    list.append(item);
  });
}

function restartQuestionnaire() {
  questionnaire = createQuizAttempt(sourceQuestionnaire);
  currentIndex = 0;
  answers = [];
  showView("quiz");
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#change-file-button").addEventListener("click", () => elements.fileInput.click());
$("#empty-load-button").addEventListener("click", () => elements.fileInput.click());
$("#error-load-button").addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", event => loadSelectedFile(event.target.files[0]));
elements.form.addEventListener("submit", correctCurrentAnswer);
elements.next.addEventListener("click", goNext);
$("#restart-button").addEventListener("click", restartQuestionnaire);
$("#review-button").addEventListener("click", () => {
  const section = $("#review-section");
  section.hidden = !section.hidden;
  $("#review-button").textContent = section.hidden ? "Revisar respuestas" : "Ocultar revisión";
  if (!section.hidden) section.scrollIntoView({ behavior: "smooth", block: "start" });
});

loadDefaultQuestionnaire();
