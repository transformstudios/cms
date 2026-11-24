import { mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import * as Globals from '@/bootstrap/globals';
import Grid from '@/components/fieldtypes/grid/Grid.vue';
import { containerContextKey } from '@/components/ui/Publish/Container.vue';

Object.keys(Globals).forEach((fn) => (window[fn] = Globals[fn]));
window.__ = (key) => key;

afterEach(() => vi.unstubAllGlobals());

test('listeners can adjust a new row before it is added', () => {
    vi.stubGlobal('Statamic', {
        $events: {
            $emit: (name, payload) => {
                if (name === 'grid-row-adding') payload.row.title = 'adjusted';
            },
        },
    });

    const wrapper = mount(Grid, {
        shallow: true,
        props: {
            value: [],
            handle: 'rows',
            config: { fields: [{ handle: 'title', type: 'text' }] },
            meta: { defaults: { title: null }, new: {}, existing: {} },
        },
        global: {
            mocks: { $keys: { bindGlobal: () => ({ destroy: () => {} }) } },
            provide: {
                [containerContextKey]: {
                    values: { value: {} },
                    errors: { value: {} },
                    setFieldValue: vi.fn(),
                    setFieldMeta: vi.fn(),
                },
            },
        },
    });

    wrapper.vm.addRow();

    expect(wrapper.emitted('update:value').at(-1)[0]).toMatchObject([{ title: 'adjusted' }]);
});
