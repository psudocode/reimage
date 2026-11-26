import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('App', () => {
  it('renders reimage heading and switches locale', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'reimage' })).toBeInTheDocument();
    expect(screen.getByText(/right in your browser/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ID' }));
    expect(screen.getByText(/langsung di browser/i)).toBeInTheDocument();
  });
});
