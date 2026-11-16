"""Compose reverse traversal, length hints and stable report ordering."""


def reverse_report():
    values = [-3, 7, -2, 4]
    paired = zip(reversed(values), range(1, 5), strict=True)
    print("reverse", list(enumerate(map(lambda pair: abs(pair[0]) * pair[1], paired), 10)))


reverse_report()
