// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';

function renderField() {
  render(
    <Field>
      <FieldLabel htmlFor="name">
        Nome <span aria-hidden="true">*</span>
      </FieldLabel>
      <FieldContent>
        <input id="name" aria-invalid="true" />
        <FieldDescription>Obrigatório</FieldDescription>
        <FieldError errors={[{ message: 'Campo obrigatório' }]} />
      </FieldContent>
    </Field>
  );
}

describe('Field components', () => {
  it('associates label with input and renders description/error', () => {
    renderField();

    expect(screen.getByRole('group')).toHaveAttribute('data-orientation', 'vertical');
    expect(screen.getByLabelText(/Nome/)).toBeInTheDocument();
    expect(screen.getByText('Obrigatório')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Campo obrigatório');
  });

  it('deduplicates error messages', () => {
    render(
      <FieldError
        errors={[{ message: 'Erro A' }, { message: 'Erro A' }, { message: 'Erro B' }]}
      />
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Erro A');
    expect(items[1]).toHaveTextContent('Erro B');
  });

  it('prefers children over errors', () => {
    render(
      <FieldError errors={[{ message: 'Ignorado' }]}>Mensagem customizada</FieldError>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Mensagem customizada');
    expect(screen.queryByText('Ignorado')).not.toBeInTheDocument();
  });

  it('renders nothing when no errors or children', () => {
    render(<FieldError errors={[]} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
