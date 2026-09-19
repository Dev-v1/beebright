from app.services.merriam_webster import _from_payload, _safe_dictionary_result, _strip_mw_markup


def entry(word, definition, example='', hom=1, origin=''):
    dt = [['text', definition]]
    if example:
        dt.append(['vis', [{'t': example}]])
    return {'meta': {'id': f'{word}:{hom}'}, 'hom': hom, 'fl': 'noun',
            'def': [{'sseq': [[['sense', {'dt': dt}]]]}], 'et': [['text', origin]]}


def test_exact_headword_rejects_related_compound():
    result = _from_payload([entry('beurre blanc', 'A butter sauce.')], 'beurre')
    assert result['found'] is False


def test_definition_and_example_come_from_same_sense():
    e = entry('bank', 'An institution that keeps money.')
    e['def'][0]['sseq'][0].append(['sense', {'dt': [
        ['text', 'The land along a river.'],
        ['vis', [{'t': 'We sat on the bank beside the river.'}]]]}])
    result = _from_payload([e], 'bank')
    assert result['definition'] == 'The land along a river.'
    assert result['sentence'] == 'We sat on the ___ beside the river.'


def test_primary_homograph_is_used_even_if_response_is_reordered():
    result = _from_payload([
        entry('bronze', 'To give the appearance of bronze to.', hom=2),
        entry('bronze', 'An alloy of copper and tin.', 'The statue was cast in bronze.', origin='French, from Italian bronzo.')
    ], 'bronze')
    assert result['definition'] == 'An alloy of copper and tin.'
    assert result['sentence'] == 'The statue was cast in ___.'
    assert 'Italian bronzo' in result['origin']


def test_origin_link_text_is_preserved():
    assert _strip_mw_markup('from {et_link|bronzo|bronzo:1}, {it}Italian{/it}') == 'from bronzo, Italian'


def test_do_not_borrow_a_different_homographs_origin():
    first = entry('bow', 'The front of a ship.')
    second = entry('bow', 'A weapon for shooting arrows.', hom=2, origin='Different history.')
    assert 'Different history' not in _from_payload([first, second], 'bow')['origin']


def test_inflected_example_does_not_change_the_expected_answer():
    result = _safe_dictionary_result({'sentence': 'She bronzed the small sculpture.'}, 'bronze')
    assert 'not yet available' in result['sentence']


def test_incomplete_text_is_not_turned_into_a_fake_complete_sentence():
    result = _safe_dictionary_result({'sentence': 'A statue made of bronze'}, 'bronze')
    assert 'not yet available' in result['sentence']
