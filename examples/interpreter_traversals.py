"""Build a reading report through lazy filtering and transformation."""


class Scale:
    def __init__(self, factor):
        self.factor = factor

    def apply(self, value):
        return self.factor * value


def readings():
    for value in [-3, 0, 2, -1]:
        yield value


selected = filter(lambda value: value != 0, readings())
converted = map(Scale(2).apply, selected)
values = list(converted)
print({"readings": values, "total": sum(values), "largest": max(values)})
print("strict", list(map(pow, [2, 3], [3, 2], strict=True)))
