"""Inspect generated syntax failures without losing their original source."""


def validate(source, filename):
    try:
        compile(source, filename, "exec")
    except SyntaxError as error:
        error.add_note("supplied record")
        return error
    return None


for source in ["雪=", "record=[", "value='unfinished"]:
    error = validate(source, "records/input.py")
    original = error.args
    error.args = ()
    print(error.msg, error.filename, error.lineno, error.offset)
    print(repr(error.text), original[1][0], error.__notes__[0])


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
