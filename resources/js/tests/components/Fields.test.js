import { mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import * as Globals from '@/bootstrap/globals';
import HiddenFieldtype from '@/components/fieldtypes/HiddenFieldtype.vue';
import Container, { injectContainerContext } from '@/components/ui/Publish/Container.vue';
import Fields from '@/components/ui/Publish/Fields.vue';
import FieldsProvider from '@/components/ui/Publish/FieldsProvider.vue';

Object.keys(Globals).forEach((fn) => (window[fn] = Globals[fn]));
window.__ = (key) => key;

window.Statamic = {
    $app: { component: (name) => (name === 'hidden-fieldtype' ? HiddenFieldtype : undefined) },
    $config: {
        get: (key) => (key === 'sites' ? [{ handle: 'default', direction: 'ltr' }] : undefined),
    },
    $dirty: { has: () => false, add: () => {}, remove: () => {} },
    $events: { $emit: () => {} },
};

const fields = [
    { handle: 'protected', type: 'toggle' },
    { handle: 'scheme', type: 'hidden', replicator_preview: true, if: { protected: 'equals true' } },
];

let previews;
let setFieldValue;

const Probe = defineComponent({
    setup() {
        ({ previews, setFieldValue } = injectContainerContext());
        return () => h('div');
    },
});

async function mountFields(values, provide = {}, props = {}) {
    const wrapper = mount(Container, {
        props: {
            blueprint: { tabs: [] },
            modelValue: values,
            site: 'default',
            ...props,
        },
        global: {
            components: { 'hidden-fieldtype': HiddenFieldtype },
            provide,
        },
        slots: {
            default: () => [h(Probe), h(FieldsProvider, { fields }, () => h(Fields))],
        },
    });

    await nextTick();

    return wrapper;
}

test('a hidden fieldtype is not visible', async () => {
    const wrapper = await mountFields({ protected: true, scheme: 'password' });

    expect(wrapper.find('.hidden-fieldtype').attributes('style')).toBe('display: none;');
});

test('a hidden fieldtype is visible on a form submission', async () => {
    const wrapper = await mountFields({ protected: true, scheme: 'password' }, { isFormSubmission: true });

    expect(wrapper.find('.hidden-fieldtype').attributes('style')).toBeUndefined();
});

test('the value of a hidden fieldtype is omitted when its conditions fail', async () => {
    const wrapper = await mountFields({ protected: false, scheme: 'password' });

    expect(wrapper.vm.visibleValues).toEqual({ protected: false });
});

test('the value of a hidden fieldtype is kept when its conditions pass', async () => {
    const wrapper = await mountFields({ protected: true, scheme: 'password' });

    expect(wrapper.vm.visibleValues).toEqual({ protected: true, scheme: 'password' });
});

test('a hidden fieldtype does not get a replicator preview', async () => {
    await mountFields({ protected: true, scheme: 'password' }, { showReplicatorFieldPreviews: true });

    expect(previews.value).toEqual({});
});

test('field ids are unique across publish containers', async () => {
    const outer = await mountFields({ protected: true, scheme: 'password' }, {}, { name: 'outer' });
    const inner = await mountFields({ protected: true, scheme: 'password' }, {}, { name: 'inner' });

    expect(outer.find('#field_outer_scheme').exists()).toBe(true);
    expect(inner.find('#field_inner_scheme').exists()).toBe(true);
});

afterEach(() => vi.restoreAllMocks());

function fieldEvents(emit) {
    return emit.mock.calls.filter(([name]) => name.startsWith('publish-field-'));
}

test('an event is emitted when a field is created and destroyed', async () => {
    const emit = vi.spyOn(window.Statamic.$events, '$emit');

    const wrapper = await mountFields({ protected: true, scheme: 'password' }, {}, { name: 'form' });

    expect(fieldEvents(emit)[1]).toEqual([
        'publish-field-created',
        { container: 'form', path: 'scheme', handle: 'scheme', config: fields[1], value: 'password' },
    ]);

    wrapper.unmount();

    expect(fieldEvents(emit).slice(-2).map(([name, { path }]) => [name, path])).toEqual([
        ['publish-field-destroyed', 'protected'],
        ['publish-field-destroyed', 'scheme'],
    ]);
});

test('an event is emitted when the value of a field changes, whoever changes it', async () => {
    const emit = vi.spyOn(window.Statamic.$events, '$emit');
    const wrapper = await mountFields({ protected: true, scheme: 'password' });

    wrapper.findComponent(HiddenFieldtype).vm.$emit('update:value', 'fieldtype');
    await nextTick();
    setFieldValue('scheme', 'code');
    await nextTick();

    expect(fieldEvents(emit).filter(([name]) => name === 'publish-field-updated').map(([, { path, value }]) => [path, value])).toEqual([
        ['scheme', 'fieldtype'],
        ['scheme', 'code'],
    ]);
});

test('no event is emitted when a value is set to what it already is', async () => {
    const emit = vi.spyOn(window.Statamic.$events, '$emit');
    await mountFields({ protected: true, scheme: 'password' });

    setFieldValue('scheme', 'password');
    await nextTick();

    expect(fieldEvents(emit).filter(([name]) => name === 'publish-field-updated')).toEqual([]);
});
