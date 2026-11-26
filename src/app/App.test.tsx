import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('App', () => {
  it('renders the reimage heading, the workspace, and switches locale', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'reimage' })).toBeInTheDocument();
    expect(screen.getByText(/right in your browser/i)).toBeInTheDocument();
    expect(screen.getByText(/Drop images here/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Compress' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ID' }));
    expect(screen.getByText(/langsung di browser/i)).toBeInTheDocument();
    expect(screen.getByText(/Letakkan gambar di sini/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ID' })).toHaveAttribute('aria-pressed', 'true');
  });
});
