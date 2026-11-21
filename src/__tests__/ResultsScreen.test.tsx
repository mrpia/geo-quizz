import { fireEvent, screen, within } from '@testing-library/react';
import raw from '../data/world.json?raw';
import { parseWorld, type WorldTopology } from '../domain/world';
import type { Answer } from '../domain/game';
import { ResultsScreen } from '../screens/ResultsScreen';
import { renderWithLanguage } from './renderWithLanguage';

const world = parseWorld(JSON.parse(raw) as WorldTopology);

const answers: Answer[] = [
  { targetId: 'FRA', pickedId: 'FRA', correct: true, elapsedMs: 2_430 },
  { targetId: 'CHE', pickedId: 'AUT', correct: false, elapsedMs: 4_000 },
  { targetId: 'POL', pickedId: null, correct: false, elapsedMs: 10_000 },
];

const setup = (lang: 'en' | 'fr' | 'de' = 'en') => {
  const onReplay = vi.fn();
  const onHome = vi.fn();
  renderWithLanguage(<ResultsScreen world={world} answers={answers} onReplay={onReplay} onHome={onHome} />, lang);
  return { onReplay, onHome };
};

const rows = () => screen.getAllByTestId('results-row');

describe('ResultsScreen', () => {
  it('shows the score out of the questions asked', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByTestId('results-score')).toHaveTextContent('1 / 3');
  });

  it('lists every question in order, marked with ✅ or ❌, not by colour alone', () => {
    setup();
    expect(rows().map((r) => r.dataset.outcome)).toEqual(['correct', 'wrong', 'timeout']);
    expect(within(rows()[0]).getByRole('img', { name: 'correct' })).toHaveTextContent('✅');
    expect(within(rows()[1]).getByRole('img', { name: 'wrong' })).toHaveTextContent('❌');
    expect(within(rows()[2]).getByRole('img', { name: 'wrong' })).toHaveTextContent('❌');
  });

  it('names the target, what was tapped or that time ran out, and the seconds taken', () => {
    setup();
    expect(rows()[0]).toHaveTextContent('France');
    expect(rows()[0]).toHaveTextContent('2.4 s');
    expect(rows()[1]).toHaveTextContent('Switzerland');
    expect(rows()[1]).toHaveTextContent('Austria');
    expect(rows()[1]).toHaveTextContent('4.0 s');
    expect(rows()[2]).toHaveTextContent('Poland');
    expect(rows()[2]).toHaveTextContent("time's up");
    expect(rows()[2]).toHaveTextContent('10.0 s');
  });

  it('speaks the language of the app, names and numbers alike', () => {
    setup('de');
    expect(rows()[1]).toHaveTextContent('Schweiz');
    expect(rows()[1]).toHaveTextContent('Österreich');
    expect(rows()[0]).toHaveTextContent('2,4 s');
    expect(rows()[2]).toHaveTextContent('Zeit abgelaufen');
  });

  it('plays again or goes home', () => {
    const { onReplay, onHome } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Play again/ }));
    expect(onReplay).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    expect(onHome).toHaveBeenCalledOnce();
  });
});
