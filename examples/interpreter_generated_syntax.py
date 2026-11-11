"""Inspect generated syntax failures without losing their original source."""


def validate(source, filename):
    try:
        compile(source, filename, "exec")
    except SyntaxError as error:
        error.add_note("supplied record")
        return error
    return None


for source in ["雪=", "record=[", "value='unfinished", "if True:\nvalue=7",
               "return 雪", "if record", "del record()", "[record,1]=value",
               "del [*record]", "[雪,*first,*last]=value",
               "def record(value=1,required): pass", "lambda *,**options: 1",
               "record(value=1,2)", "record(x for x in values,1)",
               "record(value=1,value=2)", "record(value=1,2,**options,*items)",
               "record(value=item for item in items)", "class Record(value=1,Base): pass",
               "class Record(value=1,value=2): pass", "try: pass",
               "try: pass\nexcept: pass\nexcept ValueError: pass",
               "from records import value,", "import records as value.field",
               "[first,last for item in items]", "{**item for item in items}",
               "{first:1,last}", "{first:*last}",
               "[first for last items]", "{first:last for item in items if}",
               "{first,**last}", "{first:1,last:2 for item in items}",
               "for first items: pass", "for first in : pass", "if : pass",
               "first if last", "first if last else", "if else: pass", "雪 if else 鳥", "lambda 雪: else", "lambda 雪 鳥: 1",
               "~else", "雪 and else", "雪 + else", "雪 is not else",
               "雪.else", "雪[]", "record(*else)", "record(**else)",
               "雪=else", "record(雪=else)", "assert 雪,else", "raise 雪 from else",
               "return else", "del else", "global 雪,else", "nonlocal 雪,else",
               "def else(): pass", "class else: pass", "def record: pass",
               "def record(else): pass", "def record(雪 鳥): pass", "def record(*else): pass",
               "def record() pass", "class Record pass", "lambda **+: 1", "lambda *else: 1",
               "def record(value=else): pass", "lambda value=else: 1",
               "def record(/value): pass", "lambda value,/*items: 1"]:
    error = validate(source, "records/input.py")
    original = error.args
    error.args = ()
    print(error.msg, error.filename, error.lineno, error.offset)
    print(repr(error.text), original[1][0], error.__notes__[0])

for source in ["nonlocal missing", "def record(value,value): pass"]:
    error = validate(source, "records/bindings.py")
    original = error.args
    error.args = ()
    print(error.msg, error.filename, error.lineno, error.offset)
    print(len(original), original[0] is error.msg, error._metadata is None)

try:
    compile("record=1\nrecord=2", "records/interactive.py", "single")
except SyntaxError as error:
    original = error.args
    error.args = ()
    print(error.msg, error.filename, error.lineno, error.offset)
    print(repr(error.text), original[1][0], error._metadata is None)


def pending(source):
    error = validate(source, "pending.py")
    try:
        yield error
    finally:
        print("cleanup", error.filename, error.msg)


work = pending("item=(")
saved = next(work)
saved.args = ()
work.close()
print(saved.filename, saved.end_offset)
