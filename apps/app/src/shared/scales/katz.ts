import { pointsOf, type ScaleDefinition, type ScaleItem } from './types';

const ind = (label: string) => ({ value: 1, label: `Independiente: ${label}` });
const dep = (label: string) => ({ value: 0, label: `Dependiente: ${label}` });

const items: ScaleItem[] = [
  { id: 'bano', text: 'Baño', options: [ind('se baña solo o solo necesita ayuda en una parte del cuerpo'), dep('necesita ayuda en más de una parte del cuerpo, para entrar o salir de la tina, o no se baña')] },
  { id: 'vestido', text: 'Vestido', options: [ind('saca la ropa, se la pone y se abrocha; se excluye atarse los zapatos'), dep('no se viste solo o permanece parcialmente vestido')] },
  { id: 'retrete', text: 'Uso del retrete', options: [ind('va al baño, se limpia y se arregla la ropa'), dep('necesita ayuda para ir al baño o usa cómodo/orinal')] },
  { id: 'movilidad', text: 'Movilidad (transferencias)', options: [ind('se levanta y se acuesta, se sienta y se pone de pie sin ayuda (puede usar apoyos)'), dep('necesita ayuda para levantarse o acostarse, sentarse o ponerse de pie')] },
  { id: 'continencia', text: 'Continencia', options: [ind('control completo de micción y defecación'), dep('incontinencia parcial o total, o uso de sonda o pañal')] },
  { id: 'alimentacion', text: 'Alimentación', options: [ind('lleva la comida del plato a la boca (se excluye cortar la carne)'), dep('necesita ayuda para comer, o alimentación por sonda o parenteral')] },
];

/** Orden jerárquico clásico de Katz para asignar la letra. */
const ORDER = ['bano', 'vestido', 'retrete', 'movilidad', 'continencia', 'alimentacion'] as const;

export const katz: ScaleDefinition = {
  key: 'katz',
  version: 1,
  name: 'Índice de Katz (actividades básicas de la vida diaria)',
  shortName: 'Katz',
  description: 'Independencia en seis actividades básicas: baño, vestido, uso del retrete, movilidad, continencia y alimentación.',
  domain: 'Funcionalidad',
  respondent: 'observacion',
  minutes: 5,
  higherIsBetter: true,
  reference: 'Katz S, et al. JAMA. 1963;185:914-9.',
  items,
  score(answers) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const dependent = ORDER.filter((k) => pointsOf(byId.get(k)!, answers) === 0);
    const has = (...keys: string[]) => keys.every((k) => dependent.includes(k as (typeof ORDER)[number]));
    let letter: string;
    if (dependent.length === 0) letter = 'A';
    else if (dependent.length === 1) letter = 'B';
    else if (dependent.length === 6) letter = 'G';
    else if (dependent.length === 2 && has('bano')) letter = 'C';
    else if (dependent.length === 3 && has('bano', 'vestido')) letter = 'D';
    else if (dependent.length === 4 && has('bano', 'vestido', 'retrete')) letter = 'E';
    else if (dependent.length === 5 && has('bano', 'vestido', 'retrete', 'movilidad')) letter = 'F';
    else letter = 'Otro';

    const independent = 6 - dependent.length;
    const [interpretation, severity] =
      letter === 'A'
        ? (['Independiente en todas las actividades', 'normal'] as const)
        : letter === 'B'
          ? (['Dependencia leve', 'mild'] as const)
          : letter === 'C' || letter === 'D'
            ? (['Dependencia moderada', 'moderate'] as const)
            : letter === 'Otro'
              ? (['Dependencia en dos o más actividades (no clasificable C–F)', 'moderate'] as const)
              : (['Dependencia severa', 'severe'] as const);
    return {
      score: independent,
      maxScore: 6,
      interpretation,
      severity,
      details: [{ label: 'Clasificación de Katz', value: letter }],
    };
  },
};
